import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { syncContacts } from '@/lib/whatsapp-sync';

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { instanceId } = await request.json();
    if (!instanceId) {
      return NextResponse.json({ error: 'معرف الحساب (instanceId) مطلوب' }, { status: 400 });
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

    if (instance.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'يجب أن يكون الحساب متصلاً بالواتساب لمزامنة جهات الاتصال' }, { status: 400 });
    }

    const syncResult = await syncContacts(instanceId, instance.token, { requestHistorySync: true });

    return NextResponse.json({
      success: true,
      message: `تمت المزامنة بنجاح. تم استيراد ${syncResult.syncedCount} جهة اتصال/محادثة جديدة، وتم طلب مزامنة رسائل واتساب لآخر 3 أيام وقد تظهر النتائج خلال ثوانٍ.`,
      totalContacts: syncResult.totalContacts,
      syncedCount: syncResult.syncedCount,
      historySyncRequested: syncResult.historySyncRequested
    });
  } catch (error: any) {
    console.error('Contacts sync error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء مزامنة جهات الاتصال', details: error.message },
      { status: 500 }
    );
  }
}
