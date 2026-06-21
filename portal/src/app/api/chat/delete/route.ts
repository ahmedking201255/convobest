import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp';
import { getWhatsAppMessageId } from '@/lib/inbox-store';

const DELETE_FOR_EVERYONE_LIMIT_MS = 60 * 60 * 60 * 1000; // WhatsApp currently allows roughly 2 days and 12 hours.
const DELETED_FOR_EVERYONE_TEXT = JSON.stringify({ _isDeleted: true, scope: 'everyone' });

function isAlreadyDeleted(text: string | null | undefined) {
  if (!text?.startsWith('{"_isDeleted":')) return false;
  try {
    return Boolean(JSON.parse(text)._isDeleted);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { instanceId, messageId, mode } = await request.json();
    const deleteMode = mode === 'everyone' ? 'everyone' : mode === 'me' ? 'me' : null;

    if (!instanceId || !messageId || !deleteMode) {
      return NextResponse.json({ error: 'معرف الحساب، معرف الرسالة، ونوع الحذف مطلوبة' }, { status: 400 });
    }

    const message = await prisma.inboxMessage.findFirst({
      where: {
        id: messageId,
        instanceId,
        instance: {
          userId: user.userId
        }
      },
      include: {
        instance: {
          select: {
            token: true,
            status: true
          }
        }
      }
    });

    if (!message) {
      return NextResponse.json({ error: 'الرسالة غير موجودة أو لا تملك صلاحية عليها' }, { status: 404 });
    }

    if (isAlreadyDeleted(message.text)) {
      return NextResponse.json({ error: 'تم حذف هذه الرسالة بالفعل' }, { status: 400 });
    }

    if (deleteMode === 'me') {
      await prisma.inboxMessage.delete({
        where: { id: message.id }
      });

      return NextResponse.json({ success: true, mode: deleteMode, messageId: message.id });
    }

    if (message.type !== 'SENT') {
      return NextResponse.json({ error: 'الحذف لدى الجميع متاح للرسائل التي أرسلتها فقط' }, { status: 400 });
    }

    if (message.status === 'SENDING' || message.id.startsWith('temp-')) {
      return NextResponse.json({ error: 'انتظر حتى يتم إرسال الرسالة أولاً ثم حاول حذفها' }, { status: 400 });
    }

    const messageAgeMs = Date.now() - new Date(message.createdAt).getTime();
    if (messageAgeMs > DELETE_FOR_EVERYONE_LIMIT_MS) {
      return NextResponse.json({ error: 'انتهت مدة السماح لحذف هذه الرسالة لدى الجميع' }, { status: 400 });
    }

    if (message.instance.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'يجب أن يكون حساب واتساب متصلاً لحذف الرسالة لدى الجميع' }, { status: 400 });
    }

    const whatsappMessageId = getWhatsAppMessageId(message.id, instanceId);
    const result = await whatsapp.deleteMessageForEveryone(message.instance.token, message.number, whatsappMessageId);

    const updatedMessage = await prisma.inboxMessage.update({
      where: { id: message.id },
      data: {
        text: DELETED_FOR_EVERYONE_TEXT,
        status: 'DELETED'
      }
    });

    await prisma.messageLog.updateMany({
      where: {
        OR: [
          { id: message.id },
          { id: whatsappMessageId }
        ],
        instanceId
      },
      data: {
        text: DELETED_FOR_EVERYONE_TEXT,
        status: 'DELETED'
      }
    });

    return NextResponse.json({
      success: true,
      mode: deleteMode,
      message: updatedMessage,
      result
    });
  } catch (error: any) {
    console.error('Delete inbox message error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء حذف الرسالة', details: error.message },
      { status: 500 }
    );
  }
}
