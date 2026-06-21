import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp';
import { getWhatsAppMessageId } from '@/lib/inbox-store';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { instanceId, number } = await request.json();

    if (!instanceId || !number) {
      return NextResponse.json({ error: 'معرف الحساب ورقم الهاتف حقول مطلوبة' }, { status: 400 });
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
    
    // Mark them as read via Go Engine if any exist
    if (unreadIds.length > 0) {
      try {
        await whatsapp.markRead(instance.token, number, unreadIds);
      } catch (err: any) {
        console.warn(`[MarkRead API Warning] Failed to mark read on WhatsApp:`, err.message);
      }
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

    return NextResponse.json({ success: true, markedCount: unreadIds.length });
  } catch (error: any) {
    console.error('Mark chat read error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء تحديث قراءة الدردشة', details: error.message },
      { status: 500 }
    );
  }
}
