import { prisma } from '@/lib/db';
import { getActiveSubscriptionPlan, getMonthlyMessageLimit } from '@/lib/subscription-access';

const USAGE_TIME_ZONE = 'Africa/Cairo';

export class MessageQuotaExceededError extends Error {
  status = 429;
  code = 'MONTHLY_MESSAGE_LIMIT_EXCEEDED';
  limit: number;
  used: number;
  remaining: number;

  constructor(limit: number, used: number) {
    super(`تم استهلاك الحد الشهري للإرسال بالكامل (${limit.toLocaleString('en-US')} رسالة). سيتم تجديد الرصيد تلقائيا في أول الشهر القادم.`);
    this.name = 'MessageQuotaExceededError';
    this.limit = limit;
    this.used = used;
    this.remaining = Math.max(limit - used, 0);
  }
}

export function getCurrentUsagePeriod(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: USAGE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(date);

  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  if (!year || !month) throw new Error('Unable to determine the monthly usage period');
  return `${year}-${month}`;
}

export async function getMonthlyMessageUsage(userId: string) {
  const [plan, usage] = await Promise.all([
    getActiveSubscriptionPlan(userId),
    prisma.monthlyMessageUsage.findUnique({
      where: { userId_period: { userId, period: getCurrentUsagePeriod() } },
      select: { sentCount: true }
    })
  ]);

  const limit = getMonthlyMessageLimit(plan);
  const used = usage?.sentCount || 0;
  const remaining = Math.max(limit - used, 0);

  return {
    plan,
    period: getCurrentUsagePeriod(),
    limit,
    used,
    remaining,
    percentage: limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  };
}

export async function reserveMessageQuota(userId: string, amount = 1) {
  const plan = await getActiveSubscriptionPlan(userId);
  const limit = getMonthlyMessageLimit(plan);
  const period = getCurrentUsagePeriod();

  if (amount < 1 || limit < amount) {
    throw new MessageQuotaExceededError(limit, 0);
  }

  const updatedUsage = await prisma.$transaction(async tx => {
    await tx.monthlyMessageUsage.upsert({
      where: { userId_period: { userId, period } },
      create: { userId, period, sentCount: 0 },
      update: {}
    });

    const updatedRows = await tx.$executeRaw`
      UPDATE \`MonthlyMessageUsage\`
      SET \`sentCount\` = \`sentCount\` + ${amount}, \`updatedAt\` = CURRENT_TIMESTAMP
      WHERE \`userId\` = ${userId}
        AND \`period\` = ${period}
        AND \`sentCount\` + ${amount} <= ${limit}
    `;

    if (updatedRows === 0) {
      return null;
    }

    return tx.monthlyMessageUsage.findUnique({
      where: { userId_period: { userId, period } },
      select: { sentCount: true }
    });
  });

  if (!updatedUsage) {
    const current = await prisma.monthlyMessageUsage.findUnique({
      where: { userId_period: { userId, period } },
      select: { sentCount: true }
    });
    throw new MessageQuotaExceededError(limit, current?.sentCount || limit);
  }

  return {
    plan,
    period,
    limit,
    used: updatedUsage.sentCount,
    remaining: Math.max(limit - updatedUsage.sentCount, 0)
  };
}

export async function releaseMessageQuota(userId: string, amount = 1) {
  const period = getCurrentUsagePeriod();
  await prisma.$executeRaw`
    UPDATE \`MonthlyMessageUsage\`
    SET \`sentCount\` = GREATEST(\`sentCount\` - ${amount}, 0), \`updatedAt\` = CURRENT_TIMESTAMP
    WHERE \`userId\` = ${userId} AND \`period\` = ${period}
  `;
}

export async function sendWithMessageQuota<T>(userId: string, send: () => Promise<T>) {
  await reserveMessageQuota(userId);
  try {
    return await send();
  } catch (error) {
    await releaseMessageQuota(userId).catch(releaseError => {
      console.error('[Message Quota] Failed to release reserved quota:', releaseError);
    });
    throw error;
  }
}

export function messageQuotaErrorResponse(error: unknown) {
  if (!(error instanceof MessageQuotaExceededError)) return null;
  return {
    error: error.message,
    code: error.code,
    limit: error.limit,
    used: error.used,
    remaining: error.remaining
  };
}
