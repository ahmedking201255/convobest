import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp';
import { getValidToken } from '../helper';
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

    console.log(`[Google Sheets Campaign Started] ID: ${campaignId}, Recipients: ${campaign.recipients.length}`);

    const instanceToken = campaign.instance.token;
    const messageTemplate = campaign.messageTemplate;

    for (const recipient of campaign.recipients) {
      const currentCampaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { status: true }
      });

      if (!currentCampaign || currentCampaign.status !== 'RUNNING') {
        console.log(`[Campaign Paused/Aborted] Stopping background loop for Campaign ${campaignId}`);
        return;
      }

      const messageToSend = recipient.customMessage || messageTemplate;
      console.log(`[Google Sheets Campaign Sending] Sending to ${recipient.number}...`);

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
        console.error(`[Google Sheets Campaign Send Error] Failed for number ${recipient.number}:`, err.message);

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

    console.log(`[Google Sheets Campaign Completed] ID: ${campaignId}`);
  } catch (error: any) {
    console.error(`[Google Sheets Campaign Error] Fatal campaign run error:`, error.message);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { 
      instanceId, 
      spreadsheetId, 
      sheetName, 
      messageTemplate, 
      columnMapping, 
      campaignName,
      delayMin,
      delayMax
    } = await request.json();

    if (!instanceId || !spreadsheetId || !sheetName || !messageTemplate || !columnMapping || !campaignName) {
      return NextResponse.json({ error: 'المعاملات المطلوبة ناقصة' }, { status: 400 });
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
      where: { userId: user.userId, status: 'ACTIVE', endDate: { gt: new Date() } },
      orderBy: { endDate: 'desc' }
    });

    if (!canUseGoogleSheets(activeSub?.plan)) {
      return NextResponse.json(
        { error: GOOGLE_SHEETS_UPGRADE_MESSAGE, upgradeRequired: true },
        { status: 403 }
      );
    }

    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: instanceId, userId: user.userId }
    });

    if (!instance) {
      return NextResponse.json({ error: 'مثيل الواتساب غير موجود أو لا تملكه' }, { status: 404 });
    }

    if (instance.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'حساب الواتساب غير متصل بالإنترنت حالياً' }, { status: 400 });
    }

    let token: string;
    try {
      token = await getValidToken(instanceId);
    } catch (tokenErr: any) {
      return NextResponse.json({ error: tokenErr.message, isOAuthError: true }, { status: 400 });
    }

    const range = encodeURIComponent(`${sheetName}!A1:Z10000`);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const sheetData = await response.json();

    if (!response.ok) {
      console.error('Google Sheets fetch rows error:', sheetData);
      return NextResponse.json({ error: sheetData.error?.message || 'فشل تحميل البيانات من جوجل شيتس' }, { status: response.status });
    }

    const rows = sheetData.values || [];
    if (rows.length <= 1) {
      return NextResponse.json({ error: 'لا توجد بيانات للإرسال في ملف جداول جوجل المختار (الملف يحتوي فقط على الصف الأول أو فارغ)' }, { status: 400 });
    }

    const headers: string[] = rows[0];
    const phoneColName = columnMapping.phone;
    const nameColName = columnMapping.name;
    const varsMapping = columnMapping.vars || {};

    const phoneIdx = headers.indexOf(phoneColName);
    const nameIdx = nameColName ? headers.indexOf(nameColName) : -1;

    if (phoneIdx === -1) {
      return NextResponse.json({ error: `لم يتم العثور على عمود أرقام الهواتف المسمى: "${phoneColName}"` }, { status: 400 });
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

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
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
      return NextResponse.json({ error: 'لم يتم العثور على أرقام هواتف صالحة ومطابقة للإرسال في الجدول' }, { status: 400 });
    }

    if (recipientsToCreate.length > limit) {
      return NextResponse.json({ error: `باقة اشتراكك الحالية تسمح بـ ${limit} مستلم في الحملة الواحدة كحد أقصى. الملف يحتوي على ${recipientsToCreate.length} صف.` }, { status: 400 });
    }

    const campaign = await prisma.$transaction(async (tx) => {
      const newCampaign = await tx.campaign.create({
        data: {
          userId: user.userId,
          instanceId,
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

    await prisma.googleSheetsConfig.update({
      where: { instanceId },
      data: {
        spreadsheetId,
        spreadsheetName: sheetName,
        sheetName,
        columnMapping: JSON.stringify(columnMapping)
      }
    });

    runCampaignBackground(campaign.id).catch(err => {
      console.error('[Google Sheets sync trigger error] Failed to invoke background loop:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'تم استيراد البيانات وإنشاء حملة جوجل شيتس بنجاح وهي تعمل في الخلفية الآن.',
      campaignId: campaign.id,
      count: recipientsToCreate.length
    }, { status: 201 });

  } catch (error: any) {
    console.error('Google Sheets Sync POST error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء مزامنة البيانات وإطلاق الحملة', details: error.message },
      { status: 500 }
    );
  }
}
