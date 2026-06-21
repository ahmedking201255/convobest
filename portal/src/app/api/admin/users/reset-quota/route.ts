import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getCurrentUsagePeriod } from '@/lib/message-quota';

export async function POST(request: Request) {
  try {
    const adminUser = await getSessionUser();
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const period = getCurrentUsagePeriod();
    
    // Reset the monthly usage record to 0
    await prisma.monthlyMessageUsage.upsert({
      where: { userId_period: { userId, period } },
      create: { userId, period, sentCount: 0 },
      update: { sentCount: 0 }
    });

    return NextResponse.json({ success: true, message: 'تم إعادة تعيين رصيد الاستهلاك الشهري للعميل بنجاح.' });
  } catch (error: any) {
    console.error('Error resetting user monthly usage:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
