import { prisma } from '@/lib/db';

export const GOOGLE_SHEETS_UPGRADE_MESSAGE =
  'تكامل Google Sheets متاح ضمن باقتي Pro وEnterprise. يرجى ترقية باقتك لربط الجداول وإطلاق الحملات المخصصة.';

export const MONTHLY_MESSAGE_LIMITS = {
  Starter: 100_000,
  Pro: 200_000,
  Enterprise: 600_000,
} as const;

export function getMonthlyMessageLimit(plan?: string | null) {
  const normalizedPlan = (plan || '').toLowerCase();
  if (normalizedPlan.includes('enterprise')) return MONTHLY_MESSAGE_LIMITS.Enterprise;
  if (normalizedPlan.includes('pro')) return MONTHLY_MESSAGE_LIMITS.Pro;
  if (normalizedPlan.includes('starter')) return MONTHLY_MESSAGE_LIMITS.Starter;
  return 0;
}

export function canUseGoogleSheets(plan?: string | null) {
  const normalizedPlan = (plan || '').toLowerCase();
  return normalizedPlan.includes('pro') || normalizedPlan.includes('enterprise');
}

export async function getActiveSubscriptionPlan(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      endDate: { gt: new Date() }
    },
    orderBy: { endDate: 'desc' },
    select: { plan: true }
  });

  return subscription?.plan || null;
}

export async function userCanUseGoogleSheets(userId: string) {
  return canUseGoogleSheets(await getActiveSubscriptionPlan(userId));
}
