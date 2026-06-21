import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { extractDisplayText } from '@/lib/message-display';
import { getMonthlyMessageUsage } from '@/lib/message-quota';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = sessionUser.userId;
    const now = new Date();
    const todayStart = startOfDay(now);
    const last14Start = addDays(todayStart, -13);
    const last30Start = addDays(now, -30);

    const [
      user,
      usage,
      totalInstances,
      connectedInstances,
      instances,
      sentTotal,
      receivedTotal,
      failedTotal,
      sentLast30,
      receivedLast30,
      inboxLast30,
      messagesSeriesRows,
      chatContacts,
      privateChats,
      groupChats,
      campaignsTotal,
      campaignStatusRows,
      campaignRecipientRows,
      recentCampaigns,
      totalTransactions,
      successfulTransactions,
      pendingTransactions,
      failedTransactions,
      revenueTotal,
      pendingAmount,
      recentTransactions,
      wooConfigs,
      sheetsConfigs,
      keywordRulesTotal,
      keywordRulesEnabled,
      recentLogs
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          subscriptions: {
            orderBy: { endDate: 'desc' },
            take: 1,
            select: {
              id: true,
              plan: true,
              status: true,
              startDate: true,
              endDate: true
            }
          }
        }
      }),
      getMonthlyMessageUsage(userId),
      prisma.whatsAppInstance.count({ where: { userId } }),
      prisma.whatsAppInstance.count({ where: { userId, status: 'CONNECTED' } }),
      prisma.whatsAppInstance.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          jid: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              logs: true,
              inboxMessages: true,
              chatContacts: true,
              campaigns: true
            }
          },
          woocommerceConfig: {
            select: { enabled: true, createdAt: true }
          },
          googleSheetsConfig: {
            select: { enabled: true, spreadsheetName: true, sheetName: true, createdAt: true }
          }
        }
      }),
      prisma.messageLog.count({ where: { instance: { userId }, type: 'SENT' } }),
      prisma.messageLog.count({ where: { instance: { userId }, type: 'RECEIVED' } }),
      prisma.messageLog.count({ where: { instance: { userId }, type: 'FAILED' } }),
      prisma.messageLog.count({ where: { instance: { userId }, type: 'SENT', createdAt: { gte: last30Start } } }),
      prisma.messageLog.count({ where: { instance: { userId }, type: 'RECEIVED', createdAt: { gte: last30Start } } }),
      prisma.inboxMessage.count({ where: { instance: { userId }, createdAt: { gte: last30Start } } }),
      prisma.messageLog.findMany({
        where: {
          instance: { userId },
          createdAt: { gte: last14Start }
        },
        select: { createdAt: true, type: true }
      }),
      prisma.chatContact.count({ where: { instance: { userId } } }),
      prisma.chatContact.count({ where: { instance: { userId }, isGroup: false } }),
      prisma.chatContact.count({ where: { instance: { userId }, isGroup: true } }),
      prisma.campaign.count({ where: { userId } }),
      prisma.campaign.groupBy({
        by: ['status'],
        where: { userId },
        _count: { _all: true }
      }),
      prisma.campaignRecipient.groupBy({
        by: ['status'],
        where: { campaign: { userId } },
        _count: { _all: true }
      }),
      prisma.campaign.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          delayMin: true,
          delayMax: true,
          instance: { select: { name: true } },
          _count: { select: { recipients: true } }
        }
      }),
      prisma.transaction.count({ where: { userId } }),
      prisma.transaction.count({ where: { userId, status: 'SUCCESSFUL' } }),
      prisma.transaction.count({ where: { userId, status: 'PENDING' } }),
      prisma.transaction.count({ where: { userId, status: 'FAILED' } }),
      prisma.transaction.aggregate({ where: { userId, status: 'SUCCESSFUL' }, _sum: { amount: true } }),
      prisma.transaction.aggregate({ where: { userId, status: 'PENDING' }, _sum: { amount: true } }),
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          plan: true,
          amount: true,
          senderAccount: true,
          status: true,
          createdAt: true,
          confirmedAt: true
        }
      }),
      prisma.wooCommerceConfig.findMany({
        where: { instance: { userId } },
        select: { enabled: true, createdAt: true, instance: { select: { name: true } } }
      }),
      prisma.googleSheetsConfig.findMany({
        where: { instance: { userId } },
        select: {
          enabled: true,
          spreadsheetName: true,
          sheetName: true,
          createdAt: true,
          instance: { select: { name: true } }
        }
      }),
      prisma.keywordRule.count({
        where: {
          instance: {
            userId,
            status: 'CONNECTED'
          }
        }
      }),
      prisma.keywordRule.count({
        where: {
          enabled: true,
          instance: {
            userId,
            status: 'CONNECTED'
          }
        }
      }),
      prisma.messageLog.findMany({
        where: { instance: { userId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { instance: { select: { name: true } } }
      })
    ]);

    const messagesSeriesMap = new Map<string, { sent: number; received: number; failed: number }>();
    for (let i = 13; i >= 0; i--) {
      messagesSeriesMap.set(dayKey(addDays(todayStart, -i)), { sent: 0, received: 0, failed: 0 });
    }
    messagesSeriesRows.forEach((row) => {
      const key = dayKey(row.createdAt);
      const bucket = messagesSeriesMap.get(key);
      if (!bucket) return;
      if (row.type === 'SENT') bucket.sent += 1;
      else if (row.type === 'RECEIVED') bucket.received += 1;
      else if (row.type === 'FAILED') bucket.failed += 1;
    });

    const campaignStatus = Object.fromEntries(
      campaignStatusRows.map((row) => [row.status, row._count._all])
    );
    const campaignRecipients = Object.fromEntries(
      campaignRecipientRows.map((row) => [row.status, row._count._all])
    );

    const subscription = user?.subscriptions?.[0] || null;
    const subscriptionDaysRemaining = subscription
      ? Math.ceil((new Date(subscription.endDate).getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
      : null;

    const response = NextResponse.json({
      generatedAt: now,
      account: {
        id: user?.id,
        name: user?.name,
        email: user?.email,
        createdAt: user?.createdAt,
        subscription,
        subscriptionDaysRemaining
      },
      usage,
      whatsapp: {
        totalInstances,
        connectedInstances,
        disconnectedInstances: Math.max(totalInstances - connectedInstances, 0),
        instances,
        chatContacts,
        privateChats,
        groupChats
      },
      messages: {
        sentTotal,
        receivedTotal,
        failedTotal,
        sentLast30,
        receivedLast30,
        inboxLast30,
        series: Array.from(messagesSeriesMap.entries()).map(([date, values]) => ({ date, ...values }))
      },
      campaigns: {
        total: campaignsTotal,
        status: {
          pending: campaignStatus.PENDING || 0,
          running: campaignStatus.RUNNING || 0,
          completed: campaignStatus.COMPLETED || 0,
          paused: campaignStatus.PAUSED || 0
        },
        recipients: {
          pending: campaignRecipients.PENDING || 0,
          sent: campaignRecipients.SENT || 0,
          failed: campaignRecipients.FAILED || 0
        },
        recent: recentCampaigns
      },
      billing: {
        totalTransactions,
        successfulTransactions,
        pendingTransactions,
        failedTransactions,
        paidTotal: revenueTotal._sum.amount || 0,
        pendingAmount: pendingAmount._sum.amount || 0,
        recentTransactions
      },
      automation: {
        woocommerce: {
          total: wooConfigs.length,
          enabled: wooConfigs.filter((config) => config.enabled).length,
          configs: wooConfigs
        },
        googleSheets: {
          total: sheetsConfigs.length,
          enabled: sheetsConfigs.filter((config) => config.enabled).length,
          configs: sheetsConfigs
        },
        keywordRules: {
          total: keywordRulesTotal,
          enabled: keywordRulesEnabled
        }
      },
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        instanceName: log.instance.name,
        number: log.number,
        text: extractDisplayText(log.text),
        type: log.type,
        status: log.status,
        createdAt: log.createdAt
      }))
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return response;
  } catch (error: any) {
    console.error('Error fetching dashboard reports:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
