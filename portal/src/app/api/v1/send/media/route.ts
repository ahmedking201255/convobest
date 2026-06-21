import { NextResponse } from 'next/server';
import { whatsapp } from '@/lib/whatsapp';
import { prisma } from '@/lib/db';
import { getMonthlyMessageUsage, messageQuotaErrorResponse, sendWithMessageQuota } from '@/lib/message-quota';
import { getApiInstance, sanitizeApiNumber } from '@/lib/public-api';
import { getStableContactName, saveInboxMessage } from '@/lib/inbox-store';
import { extractDisplayText } from '@/lib/message-display';

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
    const mediaType = String(body.mediatype || body.type || '').toLowerCase();
    const media = String(body.media || body.url || '');
    const caption = typeof body.caption === 'string' ? body.caption : '';
    const fileName = typeof body.filename === 'string' ? body.filename : undefined;
    const allowedTypes = new Set(['image', 'video', 'audio', 'document']);

    if (number.length < 8 || !media || !allowedTypes.has(mediaType)) {
      return NextResponse.json({ error: 'رقم المستلم ونوع الوسائط ورابط الملف مطلوبة' }, { status: 400 });
    }

    const result = await sendWithMessageQuota(instance.userId, () =>
      whatsapp.sendMedia(instance.token, number, media, caption, mediaType, fileName)
    );
    const messageId = result.data?.Info?.ID || result.data?.info?.id || result.data?.key?.id;
    const contactName = await getStableContactName(instance.id, number);
    const storedText = JSON.stringify({
      _isMedia: true,
      mediaType,
      mimetype: body.mimetype || '',
      caption,
      fileName: fileName || '',
      base64: media.startsWith('data:') ? media.split(',')[1] || '' : '',
      mediaUrl: media.startsWith('http') ? media : ''
    });

    const [usage] = await Promise.all([
      getMonthlyMessageUsage(instance.userId),
      Promise.all([
        prisma.messageLog.create({
          data: {
            id: messageId || undefined,
            instanceId: instance.id,
            number,
            contactName,
            text: extractDisplayText(storedText),
            type: 'SENT'
          }
        }).catch(error => {
          if (error?.code !== 'P2002') throw error;
        }),
        saveInboxMessage({ id: messageId, instanceId: instance.id, number, contactName, text: storedText, type: 'SENT' })
      ])
    ]);
    return NextResponse.json(
      { success: true, messageId: messageId || null, usage, result },
      {
        headers: {
          'X-RateLimit-Limit': String(usage.limit),
          'X-RateLimit-Remaining': String(usage.remaining)
        }
      }
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
    console.error('[Public API Send Media]:', error);
    return NextResponse.json({ error: 'تعذر إرسال الوسائط', details: error.message }, { status: 500 });
  }
}
