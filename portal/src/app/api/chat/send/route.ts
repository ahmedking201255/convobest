import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp';
import { getStableContactName, getWhatsAppMessageId, saveInboxMessage } from '@/lib/inbox-store';
import { extractDisplayText } from '@/lib/message-display';
import { messageQuotaErrorResponse, sendWithMessageQuota } from '@/lib/message-quota';

async function markConversationReadInBackground(token: string, instanceId: string, number: string) {
  try {
    const unreadLogs = await prisma.inboxMessage.findMany({
      where: {
        instanceId,
        number,
        type: 'RECEIVED',
        status: { not: 'READ' }
      },
      select: { id: true }
    });

    const unreadIds = unreadLogs.map(l => getWhatsAppMessageId(l.id, instanceId)).filter(Boolean);
    if (unreadIds.length > 0) {
      await whatsapp.markRead(token, number, unreadIds);
    }

    await prisma.inboxMessage.updateMany({
      where: {
        instanceId,
        number,
        type: 'RECEIVED',
        status: { not: 'READ' }
      },
      data: {
        status: 'READ'
      }
    });
  } catch (readErr: any) {
    console.warn('[Inbox Send Read Receipt Warning]:', readErr.message);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { instanceId, number, text, quoted, mediaUrl, mediaType, caption, fileName, mimetype } = await request.json();

    if (!instanceId || !number || (!text && !mediaUrl)) {
      return NextResponse.json({ error: 'معرف الحساب، رقم العميل، ونص الرسالة أو ملف الوسائط مطلوب' }, { status: 400 });
    }

    // Verify ownership of the instance
    const instance = await prisma.whatsAppInstance.findFirst({
      where: {
        id: instanceId,
        userId: user.userId
      }
    });

    if (!instance) {
      return NextResponse.json({ error: 'الحساب غير موجود أو لا تملكه' }, { status: 404 });
    }

    // Check connection status
    if (instance.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'يجب أن يكون الحساب متصلاً بالواتساب لإرسال رسالة' }, { status: 400 });
    }

    // Sanitize the target number
    const isGroup = number.includes('-') || /^120363[0-9]{9,}$/.test(number);
    const cleanNumber = isGroup ? number : number.replace(/\D/g, '');

    // Read receipts are non-critical for sending; run them without blocking delivery.
    void markConversationReadInBackground(instance.token, instanceId, cleanNumber);

    // Send the message via Go Engine
    let result;
    let dbText = text;

    if (mediaUrl && mediaType) {
      if (mediaType === 'sticker') {
        // Stickers use the dedicated /send/sticker endpoint
        result = await sendWithMessageQuota(instance.userId, () => whatsapp.sendSticker(instance.token, cleanNumber, mediaUrl));
      } else {
        result = await sendWithMessageQuota(instance.userId, () => whatsapp.sendMedia(instance.token, cleanNumber, mediaUrl, caption, mediaType, fileName));
      }

      const mediaMimetype = mimetype || (
        mediaType === 'audio'
          ? 'audio/ogg; codecs=opus'
          : mediaType === 'sticker'
            ? 'image/webp'
            : mediaType === 'video'
              ? 'video/mp4'
              : 'image/jpeg'
      );
      
      // Formulate database representation of media message
      dbText = JSON.stringify({
        _isMedia: true,
        mediaType,
        mimetype: mediaMimetype,
        caption: caption || '',
        fileName: fileName || (mediaType === 'audio' ? 'recording.ogg' : 'media.jpg'),
        base64: mediaUrl.startsWith('data:') ? mediaUrl.split(',')[1] : (mediaUrl.length > 200 ? mediaUrl : ''),
        mediaUrl: mediaUrl.startsWith('http') ? mediaUrl : ''
      });
    } else {
      result = await sendWithMessageQuota(instance.userId, () => whatsapp.sendText(instance.token, cleanNumber, text || '', quoted));
      if (quoted) {
        dbText = JSON.stringify({
          _isReply: true,
          text: text || '',
          quotedId: quoted.messageId,
          quotedText: quoted.text,
          quotedParticipant: quoted.participant,
        });
      }
    }

    // Extract WhatsApp message ID from Go Engine response
    const messageId = result.data?.Info?.ID || result.data?.info?.id || result.data?.key?.id || result.data?.key?.Id;

    const [resolvedContactName, existingMessageLog] = await Promise.all([
      getStableContactName(instanceId, cleanNumber),
      messageId ? prisma.messageLog.findUnique({
        where: { id: messageId },
        select: { instanceId: true }
      }) : Promise.resolve(null)
    ]);

    const messageLogId = existingMessageLog && existingMessageLog.instanceId !== instanceId
      ? `${instanceId}:${messageId}`
      : messageId || undefined;

    const [, newMessage] = await Promise.all([
      prisma.messageLog.create({
        data: {
          id: messageLogId, // use WhatsApp message ID, scoped per instance if another linked instance already stored it
          instanceId,
          number: cleanNumber,
          contactName: resolvedContactName,
          text: extractDisplayText(dbText),
          type: 'SENT'
        }
      }).catch(error => {
        if (error?.code !== 'P2002') throw error;
      }),
      saveInboxMessage({
        id: messageId,
        instanceId,
        number: cleanNumber,
        contactName: resolvedContactName,
        text: dbText,
        type: 'SENT',
        isGroup
      })
    ]);

    return NextResponse.json({ success: true, message: newMessage, result });
  } catch (error: any) {
    console.error('Send inbox message error:', error);
    const quotaError = messageQuotaErrorResponse(error);
    if (quotaError) return NextResponse.json(quotaError, { status: 429 });
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إرسال الرسالة', details: error.message },
      { status: 500 }
    );
  }
}
