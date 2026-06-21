import { NextResponse } from 'next/server';
import { whatsapp } from '@/lib/whatsapp';
import { prisma } from '@/lib/db';
import { getMonthlyMessageUsage, messageQuotaErrorResponse, sendWithMessageQuota } from '@/lib/message-quota';
import { getApiInstance, sanitizeApiNumber } from '@/lib/public-api';
import { getStableContactName, saveInboxMessage } from '@/lib/inbox-store';

export async function POST(request: Request) {
  try {
    const instance = await getApiInstance(request);
    if (!instance) {
      return NextResponse.json({ error: 'مفتاح API غير صالح أو غير موجود' }, { status: 401 });
    }
    if (instance.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'رقم واتساب المرتبط غير متصل حاليا' }, { status: 409 });
    }

    const body = await request.json();
    const number = sanitizeApiNumber(body.number);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (number.length < 8 || !text) {
      return NextResponse.json({ error: 'رقم المستلم ونص الرسالة مطلوبان' }, { status: 400 });
    }

    const result = await sendWithMessageQuota(instance.userId, () => whatsapp.sendText(instance.token, number, text));
    const messageId = result.data?.Info?.ID || result.data?.info?.id || result.data?.key?.id;
    const contactName = await getStableContactName(instance.id, number);

    const [usage] = await Promise.all([
      getMonthlyMessageUsage(instance.userId),
      Promise.all([
        prisma.messageLog.create({
          data: { id: messageId || undefined, instanceId: instance.id, number, contactName, text, type: 'SENT' }
        }).catch(error => {
          if (error?.code !== 'P2002') throw error;
        }),
        saveInboxMessage({ id: messageId, instanceId: instance.id, number, contactName, text, type: 'SENT' })
      ])
    ]);
    return NextResponse.json(
      { success: true, messageId: messageId || null, usage, result },
      { headers: quotaHeaders(usage) }
    );
  } catch (error: any) {
    const quotaError = messageQuotaErrorResponse(error);
    if (quotaError) {
      return NextResponse.json(quotaError, {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(quotaError.limit),
          'X-RateLimit-Remaining': '0'
        }
      });
    }
    console.error('[Public API Send Text]:', error);
    return NextResponse.json({ error: 'تعذر إرسال الرسالة', details: error.message }, { status: 500 });
  }
}

function quotaHeaders(usage: { limit: number; remaining: number }) {
  return {
    'X-RateLimit-Limit': String(usage.limit),
    'X-RateLimit-Remaining': String(usage.remaining)
  };
}
