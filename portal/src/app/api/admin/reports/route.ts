import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizePlan(plan?: string | null) {
  const value = (plan || '').toLowerCase();
  if (value.includes('enterprise')) return 'Enterprise';
  if (value.includes('pro')) return 'Pro';
  if (value.includes('starter')) return 'Starter';
  return plan || 'غير محدد';
}

const PAID_PLANS = ['Starter', 'Pro', 'Enterprise'];
const TRIAL_PLANS = ['Starter (Trial)', 'Trial'];

export async function GET() {
  try {
    const adminUser = await getSessionUser();
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const todayStart = startOfDay(now);
    const last7Start = addDays(todayStart, -6);
    const last14Start = addDays(todayStart, -13);
    const last30Start = addDays(now, -30);
    const next7End = addDays(now, 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const activePaidSubscriptionWhere = {
      status: 'ACTIVE',
      endDate: { gte: now },
      plan: { in: PAID_PLANS }
    };

    const [
      totalUsers,
      totalCustomers,
      totalAdmins,
      registrationsToday,
      registrationsLast7,
      registrationsLast30,
      registrationsSeriesUsers,
      activeTrialUsers,
      expiredTrialUsers,
      activePaidUsers,
      paidUsersGroups,
      pendingPaymentUsersGroups,
      totalTransactions,
      successfulTransactions,
      pendingTransactions,
      failedTransactions,
      revenueTotal,
      revenueThisMonth,
      pendingAmount,
      successfulByPlan,
      activeStarter,
      activePro,
      activeEnterprise,
      expiredPaidSubscriptions,
      expiringSoonSubscriptions,
      totalInstances,
      connectedInstances,
      usersWithoutInstances,
      messagesSent,
      messagesReceived,
      messagesFailed,
      messagesSentLast30,
      inboxMessagesLast30,
      recentRegistrations,
      recentSuccessfulPayments,
      pendingPaymentList,
      expiredTrialList,
      expiringSoonList
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
      prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.user.count({ where: { createdAt: { gte: last7Start } } }),
      prisma.user.count({ where: { createdAt: { gte: last30Start } } }),
      prisma.user.findMany({
        where: { createdAt: { gte: last14Start } },
        select: { createdAt: true }
      }),
      prisma.user.count({
        where: {
          subscriptions: {
            some: {
              status: 'ACTIVE',
              plan: { in: TRIAL_PLANS },
              endDate: { gte: now }
            }
          }
        }
      }),
      prisma.user.count({
        where: {
          subscriptions: {
            some: {
              plan: { in: TRIAL_PLANS },
              endDate: { lt: now }
            }
          },
          NOT: {
            subscriptions: {
              some: activePaidSubscriptionWhere
            }
          }
        }
      }),
      prisma.user.count({
        where: {
          subscriptions: {
            some: activePaidSubscriptionWhere
          }
        }
      }),
      prisma.transaction.groupBy({
        by: ['userId'],
        where: { status: 'SUCCESSFUL' },
        _count: { _all: true }
      }),
      prisma.transaction.groupBy({
        by: ['userId'],
        where: { status: 'PENDING' },
        _count: { _all: true }
      }),
      prisma.transaction.count(),
      prisma.transaction.count({ where: { status: 'SUCCESSFUL' } }),
      prisma.transaction.count({ where: { status: 'PENDING' } }),
      prisma.transaction.count({ where: { status: 'FAILED' } }),
      prisma.transaction.aggregate({
        where: { status: 'SUCCESSFUL' },
        _sum: { amount: true }
      }),
      prisma.transaction.aggregate({
        where: {
          status: 'SUCCESSFUL',
          confirmedAt: { gte: monthStart }
        },
        _sum: { amount: true }
      }),
      prisma.transaction.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true }
      }),
      prisma.transaction.groupBy({
        by: ['plan'],
        where: { status: 'SUCCESSFUL' },
        _count: { _all: true },
        _sum: { amount: true }
      }),
      prisma.subscription.count({
        where: {
          ...activePaidSubscriptionWhere,
          plan: 'Starter'
        }
      }),
      prisma.subscription.count({
        where: {
          ...activePaidSubscriptionWhere,
          plan: 'Pro'
        }
      }),
      prisma.subscription.count({
        where: {
          ...activePaidSubscriptionWhere,
          plan: 'Enterprise'
        }
      }),
      prisma.subscription.count({
        where: {
          endDate: { lt: now },
          plan: { in: PAID_PLANS }
        }
      }),
      prisma.subscription.count({
        where: {
          ...activePaidSubscriptionWhere,
          endDate: {
            gte: now,
            lte: next7End
          }
        }
      }),
      prisma.whatsAppInstance.count(),
      prisma.whatsAppInstance.count({ where: { status: 'CONNECTED' } }),
      prisma.user.count({ where: { instances: { none: {} } } }),
      prisma.messageLog.count({ where: { type: 'SENT' } }),
      prisma.messageLog.count({ where: { type: 'RECEIVED' } }),
      prisma.messageLog.count({ where: { type: 'FAILED' } }),
      prisma.messageLog.count({ where: { type: 'SENT', createdAt: { gte: last30Start } } }),
      prisma.inboxMessage.count({ where: { createdAt: { gte: last30Start } } }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          subscriptions: {
            orderBy: { endDate: 'desc' },
            take: 1,
            select: { plan: true, status: true, endDate: true }
          },
          _count: { select: { instances: true, transactions: true } }
        }
      }),
      prisma.transaction.findMany({
        where: { status: 'SUCCESSFUL' },
        orderBy: { confirmedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          plan: true,
          amount: true,
          senderAccount: true,
          confirmedAt: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.transaction.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          plan: true,
          amount: true,
          senderAccount: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.user.findMany({
        where: {
          subscriptions: {
            some: {
              plan: { in: TRIAL_PLANS },
              endDate: { lt: now }
            }
          },
          NOT: {
            subscriptions: {
              some: activePaidSubscriptionWhere
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          subscriptions: {
            where: { plan: { in: TRIAL_PLANS } },
            orderBy: { endDate: 'desc' },
            take: 1,
            select: { plan: true, status: true, endDate: true }
          },
          _count: { select: { instances: true, transactions: true } }
        }
      }),
      prisma.subscription.findMany({
        where: {
          ...activePaidSubscriptionWhere,
          endDate: {
            gte: now,
            lte: next7End
          }
        },
        orderBy: { endDate: 'asc' },
        take: 10,
        select: {
          id: true,
          plan: true,
          status: true,
          endDate: true,
          user: { select: { id: true, name: true, email: true } }
        }
      })
    ]);

    const paidUsers = paidUsersGroups.length;
    const usersWithoutSuccessfulPayment = Math.max(totalUsers - paidUsers, 0);

    const registrationSeriesMap = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      registrationSeriesMap.set(dayKey(addDays(todayStart, -i)), 0);
    }
    registrationsSeriesUsers.forEach((user) => {
      const key = dayKey(user.createdAt);
      if (registrationSeriesMap.has(key)) {
        registrationSeriesMap.set(key, (registrationSeriesMap.get(key) || 0) + 1);
      }
    });

    const revenueByPlan = successfulByPlan.reduce<Record<string, { count: number; amount: number }>>((acc, item) => {
      const plan = normalizePlan(item.plan);
      acc[plan] = {
        count: (acc[plan]?.count || 0) + (item._count._all || 0),
        amount: (acc[plan]?.amount || 0) + (item._sum.amount || 0)
      };
      return acc;
    }, {});

    return NextResponse.json({
      generatedAt: now,
      registrations: {
        totalUsers,
        totalCustomers,
        totalAdmins,
        today: registrationsToday,
        last7: registrationsLast7,
        last30: registrationsLast30,
        series: Array.from(registrationSeriesMap.entries()).map(([date, count]) => ({ date, count }))
      },
      subscriptions: {
        activePaidUsers,
        activeTrialUsers,
        expiredTrialUsers,
        paidUsers,
        usersWithoutSuccessfulPayment,
        pendingPaymentUsers: pendingPaymentUsersGroups.length,
        activePaidByPlan: {
          starter: activeStarter,
          pro: activePro,
          enterprise: activeEnterprise,
          total: activeStarter + activePro + activeEnterprise
        },
        expiredPaidSubscriptions,
        expiringSoonSubscriptions
      },
      payments: {
        totalTransactions,
        successfulTransactions,
        pendingTransactions,
        failedTransactions,
        revenueTotal: revenueTotal._sum.amount || 0,
        revenueThisMonth: revenueThisMonth._sum.amount || 0,
        pendingAmount: pendingAmount._sum.amount || 0,
        revenueByPlan
      },
      operations: {
        totalInstances,
        connectedInstances,
        disconnectedInstances: Math.max(totalInstances - connectedInstances, 0),
        usersWithoutInstances,
        messagesSent,
        messagesReceived,
        messagesFailed,
        messagesSentLast30,
        inboxMessagesLast30
      },
      lists: {
        recentRegistrations: recentRegistrations.map((user) => ({
          ...user,
          subscription: user.subscriptions[0] || null
        })),
        recentSuccessfulPayments,
        pendingPayments: pendingPaymentList,
        expiredTrials: expiredTrialList.map((user) => ({
          ...user,
          trial: user.subscriptions[0] || null
        })),
        expiringSoon: expiringSoonList
      }
    });
  } catch (error: any) {
    console.error('Error fetching admin reports:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
