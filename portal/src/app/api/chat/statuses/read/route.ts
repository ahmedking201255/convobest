import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

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

    // Target status number format
    const statusNumber = `status:${number}`;

    // Mark all status messages for this sender as READ (supports both formats)
    await prisma.messageLog.updateMany({
      where: {
        instanceId,
        OR: [
          { number: statusNumber },
          {
            number: 'status',
            contactName: number
          }
        ],
        status: { not: 'READ' }
      },
      data: {
        status: 'READ'
      }
    });

    return NextResponse.json({ success: true, message: 'تم تعيين الحالات كمقروءة' });
  } catch (error: any) {
    console.error('Mark statuses read error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء تحديث قراءة الحالات', details: error.message },
      { status: 500 }
    );
  }
}
