import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp';
import { buildCampaignMessageLogText, sendCampaignRecipientMessage } from '@/lib/campaign-send';
import { MessageQuotaExceededError } from '@/lib/message-quota';

// Helper to delay execution (same as in route.ts)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Background task runner to resume sending
async function runCampaignBackground(campaignId: string) {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        instance: true,
        recipients: {
          where: { status: 'PENDING' }
        }
      }
    });

    if (!campaign || campaign.status !== 'RUNNING') {
      return;
    }

    const instanceToken = campaign.instance.token;
    const messageTemplate = campaign.messageTemplate;

    for (const recipient of campaign.recipients) {
      // Recheck status
      const currentCampaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true }
      });

      if (!currentCampaign || currentCampaign.status !== 'RUNNING') {
        return;
      }

      const messageToSend = recipient.customMessage || messageTemplate;
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

        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'SENT',
            sentAt: new Date()
          }
        });

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
        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'FAILED',
            error: err.message || 'Failed to send message'
          }
        });

        if (err instanceof MessageQuotaExceededError) {
          await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'PAUSED' } });
          return;
        }
      }

      const delaySec = Math.floor(Math.random() * (campaign.delayMax - campaign.delayMin + 1)) + campaign.delayMin;
      await sleep(delaySec * 1000);
    }

    // Mark as completed
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED' }
    });

  } catch (error: any) {
    console.error(`[Resume Campaign Error] Campaign ${campaignId} failed:`, error.message);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { action } = await request.json();

    if (!action || !['PAUSE', 'RESUME', 'DELETE'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
    }

    // Verify campaign ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: user.userId }
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found or unauthorized' }, { status: 404 });
    }

    if (action === 'PAUSE') {
      if (campaign.status !== 'RUNNING' && campaign.status !== 'PENDING') {
        return NextResponse.json({ error: 'Campaign is not currently running' }, { status: 400 });
      }

      await prisma.campaign.update({
        where: { id },
        data: { status: 'PAUSED' }
      });

      return NextResponse.json({ message: 'Campaign paused successfully', status: 'PAUSED' });
    }

    if (action === 'RESUME') {
      if (campaign.status !== 'PAUSED') {
        return NextResponse.json({ error: 'Campaign is not paused' }, { status: 400 });
      }

      // Check if there is another campaign currently running or pending
      const activeCampaignCount = await prisma.campaign.count({
        where: {
          userId: user.userId,
          status: { in: ['RUNNING', 'PENDING'] },
          id: { not: id }
        }
      });

      if (activeCampaignCount > 0) {
        return NextResponse.json(
          { error: 'لديك حملة إرسال أخرى نشطة قيد التشغيل أو معلقة حالياً. يرجى إيقافها مؤقتاً أو انتظار اكتمالها قبل استئناف هذه الحملة.' },
          { status: 400 }
        );
      }

      // Update status to RUNNING
      const updatedCampaign = await prisma.campaign.update({
        where: { id },
        data: { status: 'RUNNING' }
      });

      // Trigger background processing loop again
      runCampaignBackground(id).catch(err => {
        console.error('[Resume Background Trigger Error]:', err);
      });

      return NextResponse.json({ message: 'Campaign resumed successfully', status: 'RUNNING' });
    }

    if (action === 'DELETE') {
      // Cascade delete campaign (Prisma schema cascade delete will clean up recipients)
      await prisma.campaign.delete({
        where: { id }
      });

      return NextResponse.json({ message: 'Campaign deleted successfully' });
    }

    return NextResponse.json({ error: 'Unsupported operation' }, { status: 400 });

  } catch (error: any) {
    console.error('Error handling campaign action:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
