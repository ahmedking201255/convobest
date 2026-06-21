import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');
    const number = searchParams.get('number');

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

    // Sanitize the target number (for groups we can keep it as is, standard digits only is for users)
    const isGroup = number.includes('-') || number.length > 14;
    const cleanNumber = isGroup ? number : number.replace(/\D/g, '');

    try {
      const avatarResult = await whatsapp.getAvatar(instance.token, cleanNumber);
      const url = avatarResult?.data?.URL || avatarResult?.data?.url || null;
      return NextResponse.json({ url });
    } catch (avatarErr: any) {
      // It is normal for contacts to not have an avatar, do not throw 500
      console.log(`[Avatar Route API Notice] No profile picture for ${cleanNumber}:`, avatarErr.message);
      return NextResponse.json({ url: null });
    }

  } catch (error: any) {
    console.error('Fetch avatar route error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء جلب صورة الملف الشخصي', details: error.message },
      { status: 500 }
    );
  }
}
