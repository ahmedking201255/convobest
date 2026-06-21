import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { whatsapp } from '@/lib/whatsapp';
import { canUseGoogleSheets, GOOGLE_SHEETS_UPGRADE_MESSAGE } from '@/lib/subscription-access';
import { MessageQuotaExceededError, sendWithMessageQuota } from '@/lib/message-quota';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

    if (!campaign || campaign.status === 'PAUSED') {
      return;
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'RUNNING' }
    });

    const instanceToken = campaign.instance.token;
    const messageTemplate = campaign.messageTemplate;

    for (const recipient of campaign.recipients) {
      const currentCampaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true }
      });

      if (!currentCampaign || currentCampaign.status !== 'RUNNING') {
        return;
      }

      const messageToSend = recipient.customMessage || messageTemplate;

      try {
        try {
          await whatsapp.setPresence(instanceToken, recipient.number, 'composing');
          await sleep(1500);
        } catch (presenceErr: any) {
          console.warn('[Campaign Presence Warning]:', presenceErr.message);
        }

        const result = await sendWithMessageQuota(campaign.userId, () => whatsapp.sendText(instanceToken, recipient.number, messageToSend));
        const messageId = result.data?.Info?.ID || result.data?.info?.id || result.data?.key?.id;

        await prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'SENT',
            sentAt: new Date()
          }
        });

        await prisma.messageLog.create({
          data: {
            id: messageId || undefined,
            instanceId: campaign.instanceId,
            number: recipient.number,
            text: messageToSend,
            type: 'SENT'
          }
        });

      } catch (err: any) {
        console.error(`[Apps Script Campaign Send Error] Failed for ${recipient.number}:`, err.message);

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

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED' }
    });
  } catch (error: any) {
    console.error(`[Apps Script Campaign Error] Fatal campaign run error:`, error.message);
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'مفتاح الوصول غير صحيح (Authorization header missing or invalid)' }, { status: 401 });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return NextResponse.json({ error: 'مفتاح الوصول فارغ' }, { status: 401 });
    }

    const instance = await prisma.whatsAppInstance.findFirst({
      where: { token },
      include: {
        user: {
          include: {
            subscriptions: {
              where: { status: 'ACTIVE', endDate: { gt: new Date() } },
              orderBy: { endDate: 'desc' }
            }
          }
        }
      }
    });

    if (!instance) {
      return NextResponse.json({ error: 'مثيل الواتساب غير موجود أو مفتاح الوصول منتهى' }, { status: 401 });
    }

    if (instance.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'رقم الواتساب غير متصل حالياً بالإنترنت' }, { status: 400 });
    }

    const user = instance.user;
    const activeSub = user.subscriptions[0];

    if (!canUseGoogleSheets(activeSub?.plan)) {
      return NextResponse.json(
        { error: GOOGLE_SHEETS_UPGRADE_MESSAGE, upgradeRequired: true },
        { status: 403 }
      );
    }

    const { 
      campaignName,
      messageTemplate,
      columnMapping,
      headers,
      rows,
      delayMin,
      delayMax
    } = await request.json();

    if (!campaignName || !messageTemplate || !columnMapping || !headers || !rows || !Array.isArray(headers) || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'البيانات المرسلة ناقصة أو غير صالحة' }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'لا توجد صفوف بيانات للإرسال' }, { status: 400 });
    }

    // Check if there is already an active running or pending campaign for this user
    const activeCampaignCount = await prisma.campaign.count({
      where: {
        userId: user.id,
        status: { in: ['RUNNING', 'PENDING'] }
      }
    });

    if (activeCampaignCount > 0) {
      return NextResponse.json(
        { error: 'لديك حملة إرسال نشطة بالفعل قيد التشغيل أو معلقة. يجب انتظار اكتمال الحملة الحالية أو إيقافها مؤقتاً قبل البدء في حملة جديدة.' },
        { status: 400 }
      );
    }

    const phoneColName = columnMapping.phone;
    const nameColName = columnMapping.name;
    const varsMapping = columnMapping.vars || {};

    const phoneIdx = headers.indexOf(phoneColName);
    const nameIdx = nameColName ? headers.indexOf(nameColName) : -1;

    if (phoneIdx === -1) {
      return NextResponse.json({ error: `لم يتم العثور على عمود أرقام الهواتف: "${phoneColName}"` }, { status: 400 });
    }

    const varIndices: Record<string, number> = {};
    for (const [varPlaceholder, colName] of Object.entries(varsMapping)) {
      const idx = headers.indexOf(colName as string);
      if (idx !== -1) {
        varIndices[varPlaceholder] = idx;
      }
    }

    const isEnterprise = activeSub?.plan?.toLowerCase().includes('enterprise');
    const limit = isEnterprise ? 10000 : 2000;
    
    const recipientsToCreate: Array<{ number: string; customMessage: string }> = [];

    for (const row of rows) {
      if (!row || row.length === 0) continue;

      const rawPhone = row[phoneIdx];
      if (!rawPhone) continue;

      const cleanPhone = String(rawPhone).replace(/\D/g, '');
      if (cleanPhone.length < 8) continue;

      let messageText = messageTemplate;

      if (nameIdx !== -1 && row[nameIdx]) {
        messageText = messageText.replace(/{customer_name}/g, String(row[nameIdx]));
      } else {
        messageText = messageText.replace(/{customer_name}/g, '');
      }

      for (const [placeholder, idx] of Object.entries(varIndices)) {
        const value = row[idx] !== undefined ? String(row[idx]) : '';
        messageText = messageText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
      }

      recipientsToCreate.push({
        number: cleanPhone,
        customMessage: messageText
      });
    }

    if (recipientsToCreate.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على أرقام هواتف صالحة في الصفوف المرسسة' }, { status: 400 });
    }

    if (recipientsToCreate.length > limit) {
      return NextResponse.json({ error: `باقة الاشتراك تسمح بـ ${limit} مستلم في الحملة كحد أقصى. تم إرسال ${recipientsToCreate.length} صف.` }, { status: 400 });
    }

    const campaign = await prisma.$transaction(async (tx) => {
      const newCampaign = await tx.campaign.create({
        data: {
          userId: user.id,
          instanceId: instance.id,
          name: campaignName,
          messageTemplate,
          status: 'PENDING',
          delayMin: Number(delayMin) || 5,
          delayMax: Number(delayMax) || 15
        }
      });

      const recipientsData = recipientsToCreate.map(r => ({
        campaignId: newCampaign.id,
        number: r.number,
        customMessage: r.customMessage,
        status: 'PENDING'
      }));

      await tx.campaignRecipient.createMany({
        data: recipientsData
      });

      return newCampaign;
    });

    runCampaignBackground(campaign.id).catch(err => {
      console.error('[Apps Script Campaign Background Trigger Error]:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'تم استلام البيانات وجاري بدء حملة الإرسال في خلفية البوابة بنجاح.',
      campaignId: campaign.id,
      count: recipientsToCreate.length
    });

  } catch (error: any) {
    console.error('Apps Script Sync POST error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما في معالجة طلب Apps Script', details: error.message },
      { status: 500 }
    );
  }
}
