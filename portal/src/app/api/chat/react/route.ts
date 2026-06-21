import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getWhatsAppMessageId } from '@/lib/inbox-store';
import { whatsapp } from '@/lib/whatsapp';

const ALLOWED_REACTIONS = new Set(['👍', '❤️', '😂', '😮', '😢', '🙏', '']);

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { instanceId, messageId, reaction } = await request.json();
    const normalizedReaction = typeof reaction === 'string' ? reaction.trim() : '';

    if (!instanceId || !messageId || !ALLOWED_REACTIONS.has(normalizedReaction)) {
      return NextResponse.json({ error: 'بيانات الريأكشن غير صحيحة' }, { status: 400 });
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
        instance: true
      }
    });

    if (!message) {
      return NextResponse.json({ error: 'الرسالة غير موجودة أو لا تملك صلاحية عليها' }, { status: 404 });
    }

    if (message.text.startsWith('{"_isDeleted":')) {
      return NextResponse.json({ error: 'لا يمكن عمل ريأكشن على رسالة محذوفة' }, { status: 400 });
    }

    if (message.instance.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'يجب أن يكون رقم الواتساب متصلا لإرسال الريأكشن' }, { status: 400 });
    }

    const whatsappMessageId = getWhatsAppMessageId(message.id, instanceId);
    const engineReaction = normalizedReaction || 'remove';

    const result = await whatsapp.reactToMessage(
      message.instance.token,
      message.number,
      whatsappMessageId,
      engineReaction,
      message.type === 'SENT'
    );

    const updated = await prisma.inboxMessage.update({
      where: { id: message.id },
      data: {
        reactionFromMe: normalizedReaction || null
      }
    });

    return NextResponse.json({
      success: true,
      message: updated,
      result
    });
  } catch (error: any) {
    console.error('React inbox message error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إرسال الريأكشن', details: error.message },
      { status: 500 }
    );
  }
}
