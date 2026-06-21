import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const countPlan = (subscriptions: { plan: string }[], planName: string) =>
      subscriptions.filter((sub) => sub.plan.toLowerCase().includes(planName.toLowerCase())).length;

    // 1. Total users
    const totalUsers = await prisma.user.count();

    // 2. WhatsApp instance counts
    const totalInstances = await prisma.whatsAppInstance.count();
    const activeInstances = await prisma.whatsAppInstance.count({
      where: { status: 'CONNECTED' },
    });

    // 3. Message log counts
    const messagesSent = await prisma.messageLog.count({
      where: { type: 'SENT' },
    });
    const messagesReceived = await prisma.messageLog.count({
      where: { type: 'RECEIVED' },
    });
    const messagesFailed = await prisma.messageLog.count({
      where: { type: 'FAILED' },
    });

    // 4. Subscription breakdown. Count in JS to avoid MariaDB collation issues with LIKE.
    const activeSubscriptions = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      select: { plan: true },
    });
    const activeStarter = countPlan(activeSubscriptions, 'Starter');
    const activePro = countPlan(activeSubscriptions, 'Pro');
    const activeEnterprise = countPlan(activeSubscriptions, 'Enterprise');

    return NextResponse.json({
      totalUsers,
      totalInstances,
      activeInstances,
      messagesSent,
      messagesReceived,
      messagesFailed,
      subscriptions: {
        starter: activeStarter,
        pro: activePro,
        enterprise: activeEnterprise,
        totalActive: activeStarter + activePro + activeEnterprise,
      }
    });
  } catch (error: any) {
    console.error('Error fetching admin global stats:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
