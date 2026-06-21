import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp';
import { buildCampaignMessageLogText, normalizeCampaignAttachment, sendCampaignRecipientMessage } from '@/lib/campaign-send';
import { MessageQuotaExceededError } from '@/lib/message-quota';

// Helper to delay execution
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function canUseCampaigns(plan?: string | null) {
  const normalized = (plan || '').toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('trial')) return false;
  return normalized.includes('starter') || normalized.includes('pro') || normalized.includes('enterprise');
}

function getCampaignLimit(plan?: string | null) {
  const normalized = (plan || '').toLowerCase();
  if (normalized.includes('enterprise')) return 10000;
  if (normalized.includes('pro')) return 2000;
  if (normalized.includes('starter')) return 350;
  return 0;
}

// Run the campaign sending loop in the background asynchronously
async function runCampaignBackground(campaignId: string) {
  try {
    // 1. Fetch campaign and verify it exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        instance: true,
        recipients: {
          where: { status: 'PENDING' }
        }
      }
    });

    if (!campaign || campaign.status === 'PAUSED') {
      return;
    }

    // Update status to RUNNING
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' }
    });

    console.log(`[Campaign Started] ID: ${campaignId}, Recipients: ${campaign.recipients.length}`);

    const instanceToken = campaign.instance.token;
    const messageTemplate = campaign.messageTemplate;

    for (const recipient of campaign.recipients) {
      // Re-fetch campaign status before sending to check if paused/stopped in real time
      const currentCampaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true }
      });

      if (!currentCampaign || currentCampaign.status !== 'RUNNING') {
        console.log(`[Campaign Paused/Aborted] Stopping background loop for Campaign ${campaignId}`);
        return;
      }

      const messageToSend = recipient.customMessage || messageTemplate;
      console.log(`[Campaign Sending] Sending message to ${recipient.number}...`);

      try {
        // Send typing presence (simulating human usage)
        try {
          await whatsapp.setPresence(instanceToken, recipient.number, 'composing');
          await sleep(1500);
        } catch (presenceErr: any) {
          console.warn('[Campaign Presence Warning]:', presenceErr.message);
        }

        // Send message via evolution go engine
        const result = await sendCampaignRecipientMessage(campaign, instanceToken, recipient.number, messageToSend);
        const messageId = result.data?.Info?.ID || result.data?.info?.id || result.data?.key?.id;
        const logText = buildCampaignMessageLogText(campaign, messageToSend);

        // Update recipient to SENT
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'SENT',
            sentAt: new Date()
          }
        });

        // Log to global MessageLog for this instance so it shows in general analytics
        await prisma.messageLog.create({
          data: {
            id: messageId || undefined, // use WhatsApp message ID if available
            instanceId: campaign.instanceId,
            number: recipient.number,
            text: logText,
            type: 'SENT'
          }
        });

      } catch (err: any) {
        console.error(`[Campaign Send Error] Failed for number ${recipient.number}:`, err.message);

        // Update recipient to FAILED
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            error: err.message || 'Failed to send message'
          }
        });

        if (err instanceof MessageQuotaExceededError) {
          await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } });
          console.warn(`[Campaign Quota] Campaign ${campaignId} paused because the monthly sending limit was reached.`);
          return;
        }
      }

      // Random delay between delayMin and delayMax (convert to ms)
      const delaySec = Math.floor(Math.random() * (campaign.delayMax - campaign.delayMin + 1)) + campaign.delayMin;
      console.log(`[Campaign Sleep] Waiting ${delaySec} seconds before next send...`);
      await sleep(delaySec * 1000);
    }

    // Set campaign to COMPLETED
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED' }
    });

    console.log(`[Campaign Completed] ID: ${campaignId}`);

  } catch (error: any) {
    console.error(`[Campaign Error] Fatal campaign run error:`, error.message);
  }
}

// GET: Retrieve campaigns list with recipient counters
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const campaigns = await prisma.campaign.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        instance: {
          select: { name: true }
        },
        recipients: {
          select: { status: true }
        }
      }
    });

    const formattedCampaigns = campaigns.map(c => {
      const total = c.recipients.length;
      const sent = c.recipients.filter(r => r.status === 'SENT').length;
      const failed = c.recipients.filter(r => r.status === 'FAILED').length;
      const pending = c.recipients.filter(r => r.status === 'PENDING').length;

      return {
        id: c.id,
        name: c.name,
        instanceName: c.instance.name,
        instanceId: c.instanceId,
        messageTemplate: c.messageTemplate,
        attachmentType: c.attachmentType,
        attachmentName: c.attachmentName,
        status: c.status,
        delayMin: c.delayMin,
        delayMax: c.delayMax,
        createdAt: c.createdAt,
        stats: { total, sent, failed, pending }
      };
    });

    return NextResponse.json({ campaigns: formattedCampaigns });
  } catch (error: any) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// POST: Create a new Campaign
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, instanceId, messageTemplate, numbers, delayMin, delayMax, attachment } = await request.json();

    if (!name || !instanceId || !messageTemplate || !numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return NextResponse.json({ error: 'Invalid campaign request parameters' }, { status: 400 });
    }

    let normalizedAttachment: ReturnType<typeof normalizeCampaignAttachment> = null;
    try {
      normalizedAttachment = normalizeCampaignAttachment(attachment);
    } catch {
      return NextResponse.json({ error: 'Invalid campaign attachment' }, { status: 400 });
    }

    // Check if there is already an active running or pending campaign for this user
    const activeCampaignCount = await prisma.campaign.count({
      where: {
        userId: user.userId,
        status: { in: ['RUNNING', 'PENDING'] }
      }
    });

    if (activeCampaignCount > 0) {
      return NextResponse.json(
        { error: 'لديك حملة إرسال نشطة بالفعل قيد التشغيل أو معلقة. يجب انتظار اكتمال الحملة الحالية أو إيقافها مؤقتاً قبل البدء في حملة جديدة.' },
        { status: 400 }
      );
    }

    const activeSub = await prisma.subscription.findFirst({
      where: { userId: user.userId, status: 'ACTIVE' },
      orderBy: { endDate: 'desc' }
    });

    if (!canUseCampaigns(activeSub?.plan)) {
      return NextResponse.json(
        { error: 'حملات الإرسال غير متاحة في الفترة التجريبية أو الحسابات المجانية. يرجى تفعيل أو ترقية باقتك للبدء في استخدام الحملات.' },
        { status: 403 }
      );
    }

    // Verify instance ownership and connection status
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: instanceId, userId: user.userId }
    });

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found or unauthorized' }, { status: 404 });
    }

    if (instance.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'WhatsApp instance is not connected. Please scan QR first.' }, { status: 400 });
    }

    // Clean numbers list (extract digits only)
    const cleanNumbers = numbers
      .map(num => String(num).replace(/\D/g, ''))
      .filter(num => num.length >= 8); // Minimum standard length

    if (cleanNumbers.length === 0) {
      return NextResponse.json({ error: 'No valid phone numbers found' }, { status: 400 });
    }

    const limit = getCampaignLimit(activeSub?.plan);
    if (cleanNumbers.length > limit) {
      return NextResponse.json({ error: `خطة اشتراكك الحالية تسمح بإرسال ${limit} جهة اتصال في الحملة الواحدة كحد أقصى.` }, { status: 400 });
    }

    // Save campaign in database inside transaction
    const campaign = await prisma.$transaction(async (tx) => {
      const newCampaign = await tx.campaign.create({
        data: {
          userId: user.userId,
          instanceId,
          name,
          messageTemplate,
          ...(normalizedAttachment || {}),
          status: 'PENDING',
          delayMin: Number(delayMin) || 5,
          delayMax: Number(delayMax) || 15
        }
      });

      // Add all recipients
      const recipientsData = cleanNumbers.map(num => ({
        campaignId: newCampaign.id,
        number: num,
        status: 'PENDING'
      }));

      await tx.campaignRecipient.createMany({
        data: recipientsData
      });

      return newCampaign;
    });

    // Trigger campaign run asynchronously in background
    runCampaignBackground(campaign.id).catch(err => {
      console.error('[Campaign Background Trigger Error] Failed to invoke loop:', err);
    });

    return NextResponse.json({
      message: 'Campaign created and started successfully',
      campaignId: campaign.id
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating campaign:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
