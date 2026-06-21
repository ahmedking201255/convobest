import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { upsertChatContact } from '@/lib/inbox-store';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { instanceId, number, contactName } = await request.json();

    if (!instanceId || !number || !contactName) {
      return NextResponse.json({ error: 'معرف الحساب، رقم الهاتف، واسم العميل حقول مطلوبة' }, { status: 400 });
    }

    const instance = await prisma.whatsAppInstance.findFirst({
      where: {
        id: instanceId,
        userId: user.userId
      }
    });

    if (!instance) {
      return NextResponse.json({ error: 'الحساب غير موجود أو لا تملكه' }, { status: 404 });
    }

    const cleanNumber = number.replace(/\D/g, '');

    if (!cleanNumber) {
      return NextResponse.json({ error: 'رقم الهاتف غير صالح' }, { status: 400 });
    }

    await upsertChatContact({
      instanceId,
      number: cleanNumber,
      contactName,
      isGroup: false
    });

    await prisma.inboxMessage.updateMany({
      where: {
        instanceId,
        number: cleanNumber
      },
      data: {
        contactName
      }
    });

    return NextResponse.json({ success: true, message: 'تمت إضافة جهة الاتصال بنجاح' });
  } catch (error: any) {
    console.error('Create contact error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إضافة جهة الاتصال', details: error.message },
      { status: 500 }
    );
  }
}
