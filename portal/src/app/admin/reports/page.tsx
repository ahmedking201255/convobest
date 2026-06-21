'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  CreditCard,
  MessageSquare,
  RefreshCw,
  Smartphone,
  TimerReset,
  TrendingUp,
  UserPlus,
  Wallet,
  XCircle
} from 'lucide-react';

function formatNumber(value: any) {
  return Number(value || 0).toLocaleString('ar-EG');
}

function formatCurrency(value: any) {
  return `${Number(value || 0).toLocaleString('ar-EG')} ج.م`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return 'غير محدد';
  return new Intl.DateTimeFormat('ar-EG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function daysUntil(value?: string | Date | null) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function displayUser(user: any) {
  return user?.name || user?.email || 'مستخدم غير معروف';
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = 'green'
}: {
  title: string;
  value: string;
  hint?: string;
  icon: any;
  tone?: 'green' | 'blue' | 'orange' | 'red' | 'gray';
}) {
  const tones = {
    green: 'bg-[#00ffa7]/10 border-[#00ffa7]/20 text-[#00ffa7]',
    blue: 'bg-[#00b0ff]/10 border-[#00b0ff]/20 text-[#00b0ff]',
    orange: 'bg-[#ff9100]/10 border-[#ff9100]/20 text-[#ff9100]',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    gray: 'bg-[#607d8b]/10 border-[#607d8b]/20 text-[#90a4ae]'
  };

  return (
    <div className="glass-card flex items-center justify-between gap-4 border-[rgba(255,145,0,0.06)]">
      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${tones[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-right min-w-0">
        <p className="text-xs text-[#607d8b] font-bold">{title}</p>
        <h3 className="text-2xl font-black text-white mt-1">{value}</h3>
        {hint && <p className="text-[10px] text-[#90a4ae] mt-1 truncate">{hint}</p>}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-8 text-center text-xs text-[#607d8b] border border-dashed border-[rgba(255,255,255,0.08)] rounded-xl">
      {text}
    </div>
  );
}

export default function AdminReportsPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    try {
      setError('');
      const res = await fetch('/api/admin/reports', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر تحميل التقارير.');
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل التقارير.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const maxRegistrations = useMemo(() => {
    const series = report?.registrations?.series || [];
    return Math.max(...series.map((item: any) => item.count), 1);
  }, [report]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff9100] to-[#ff3d00] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#060b11] animate-spin" />
          </div>
          <span className="text-xs text-[#90a4ae]">جاري تجهيز تقارير الإدارة...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const registrations = report.registrations;
  const subscriptions = report.subscriptions;
  const payments = report.payments;
  const operations = report.operations;
  const lists = report.lists;
  const paidRatio = registrations.totalUsers
    ? Math.round((subscriptions.paidUsers / registrations.totalUsers) * 100)
    : 0;
  const connectedRatio = operations.totalInstances
    ? Math.round((operations.connectedInstances / operations.totalInstances) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-8 text-right animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">تقارير الإدارة</h1>
          <p className="text-xs text-[#90a4ae] mt-1">
            متابعة التسجيلات، الاشتراكات، المدفوعات، التجارب، واستخدام المنصة من مكان واحد.
          </p>
        </div>
        <button
          onClick={fetchReport}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#ff9100]/20 bg-[#ff9100]/10 text-[#ff9100] text-xs font-bold hover:bg-[#ff9100]/15 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث التقارير
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="إجمالي التسجيلات"
          value={formatNumber(registrations.totalUsers)}
          hint={`${formatNumber(registrations.today)} اليوم | ${formatNumber(registrations.last7)} آخر 7 أيام`}
          icon={UserPlus}
          tone="orange"
        />
        <StatCard
          title="عملاء دفعوا"
          value={formatNumber(subscriptions.paidUsers)}
          hint={`${paidRatio}% من إجمالي الحسابات`}
          icon={Wallet}
          tone="green"
        />
        <StatCard
          title="على فترة التجربة"
          value={formatNumber(subscriptions.activeTrialUsers)}
          hint={`${formatNumber(subscriptions.expiredTrialUsers)} انتهت تجربتهم بدون دفع`}
          icon={TimerReset}
          tone="blue"
        />
        <StatCard
          title="مدفوعات معلقة"
          value={formatNumber(payments.pendingTransactions)}
          hint={`قيمة معلقة ${formatCurrency(payments.pendingAmount)}`}
          icon={Clock3}
          tone="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 glass-card flex flex-col gap-5 border-[rgba(255,145,0,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">تحليل الاشتراكات والدفع</h2>
              <p className="text-[11px] text-[#607d8b] mt-1">فصل واضح بين المدفوع، التجربة، وانتهاء الصلاحية.</p>
            </div>
            <CreditCard className="w-5 h-5 text-[#ff9100]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['اشتراكات مدفوعة نشطة', subscriptions.activePaidUsers, 'green'],
              ['حسابات لم تدفع بعد', subscriptions.usersWithoutSuccessfulPayment, 'gray'],
              ['اشتراكات مدفوعة منتهية', subscriptions.expiredPaidSubscriptions, 'red'],
              ['تنتهي خلال 7 أيام', subscriptions.expiringSoonSubscriptions, 'orange']
            ].map(([label, value, tone]) => (
              <div key={String(label)} className="flex items-center justify-between rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] px-4 py-3">
                <span className="text-xs text-[#90a4ae] font-bold">{label}</span>
                <span className={`text-lg font-black ${
                  tone === 'green' ? 'text-[#00ffa7]' : tone === 'red' ? 'text-red-400' : tone === 'orange' ? 'text-[#ff9100]' : 'text-white'
                }`}>
                  {formatNumber(value)}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <h3 className="text-xs font-bold text-white mb-3">تقسيم الباقات المدفوعة النشطة</h3>
            <div className="space-y-3">
              {[
                ['Starter', subscriptions.activePaidByPlan.starter, '#90a4ae'],
                ['Pro', subscriptions.activePaidByPlan.pro, '#00ffa7'],
                ['Enterprise', subscriptions.activePaidByPlan.enterprise, '#00b0ff']
              ].map(([plan, count, color]) => {
                const total = Math.max(subscriptions.activePaidByPlan.total, 1);
                const width = Math.max((Number(count) / total) * 100, Number(count) > 0 ? 6 : 0);
                return (
                  <div key={String(plan)} className="flex items-center gap-3">
                    <span className="w-24 text-[11px] font-bold text-[#90a4ae]">{plan}</span>
                    <div className="flex-1 h-2 rounded-full bg-[#07090e] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: String(color) }} />
                    </div>
                    <span className="w-10 text-left text-xs font-black text-white">{formatNumber(count)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="lg:col-span-5 glass-card flex flex-col gap-5 border-[rgba(255,145,0,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">الإيرادات والمعاملات</h2>
              <p className="text-[11px] text-[#607d8b] mt-1">ملخص مالي سريع حسب حالة الدفع.</p>
            </div>
            <TrendingUp className="w-5 h-5 text-[#00ffa7]" />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl bg-[#00ffa7]/5 border border-[#00ffa7]/15 p-4">
              <p className="text-xs text-[#90a4ae] font-bold">إجمالي الإيرادات المؤكدة</p>
              <h3 className="text-2xl font-black text-[#00ffa7] mt-1">{formatCurrency(payments.revenueTotal)}</h3>
              <p className="text-[10px] text-[#607d8b] mt-1">هذا الشهر: {formatCurrency(payments.revenueThisMonth)}</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-3">
                <CheckCircle2 className="w-4 h-4 text-[#00ffa7] mb-2" />
                <p className="text-[10px] text-[#607d8b] font-bold">ناجحة</p>
                <p className="text-lg font-black text-white">{formatNumber(payments.successfulTransactions)}</p>
              </div>
              <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-3">
                <Clock3 className="w-4 h-4 text-[#ff9100] mb-2" />
                <p className="text-[10px] text-[#607d8b] font-bold">معلقة</p>
                <p className="text-lg font-black text-white">{formatNumber(payments.pendingTransactions)}</p>
              </div>
              <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-3">
                <XCircle className="w-4 h-4 text-red-400 mb-2" />
                <p className="text-[10px] text-[#607d8b] font-bold">فاشلة</p>
                <p className="text-lg font-black text-white">{formatNumber(payments.failedTransactions)}</p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 glass-card flex flex-col gap-5 border-[rgba(255,145,0,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">التسجيلات آخر 14 يوم</h2>
              <p className="text-[11px] text-[#607d8b] mt-1">اتجاه التسجيلات اليومي لمتابعة أثر التسويق والمبيعات.</p>
            </div>
            <BarChart3 className="w-5 h-5 text-[#00b0ff]" />
          </div>
          <div className="h-56 flex items-end gap-2 border-b border-[rgba(255,255,255,0.06)] pb-3">
            {registrations.series.map((item: any) => {
              const height = Math.max((item.count / maxRegistrations) * 100, item.count > 0 ? 10 : 3);
              return (
                <div key={item.date} className="flex-1 h-full flex flex-col justify-end items-center gap-2 min-w-0">
                  <div className="text-[10px] text-[#90a4ae] font-bold">{formatNumber(item.count)}</div>
                  <div className="w-full max-w-8 rounded-t-lg bg-gradient-to-t from-[#ff9100] to-[#00ffa7]" style={{ height: `${height}%` }} />
                  <div className="text-[9px] text-[#607d8b] truncate w-full text-center">{item.date.slice(5)}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-5 glass-card flex flex-col gap-5 border-[rgba(255,145,0,0.06)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">تشغيل المنصة</h2>
              <p className="text-[11px] text-[#607d8b] mt-1">الصحة العامة للأرقام والرسائل.</p>
            </div>
            <Smartphone className="w-5 h-5 text-[#00ffa7]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
              <p className="text-[10px] text-[#607d8b] font-bold">أرقام متصلة</p>
              <p className="text-xl font-black text-white mt-1">{formatNumber(operations.connectedInstances)} / {formatNumber(operations.totalInstances)}</p>
              <p className="text-[10px] text-[#00ffa7] mt-1">{connectedRatio}% اتصال</p>
            </div>
            <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
              <p className="text-[10px] text-[#607d8b] font-bold">بدون رقم واتساب</p>
              <p className="text-xl font-black text-white mt-1">{formatNumber(operations.usersWithoutInstances)}</p>
              <p className="text-[10px] text-[#ff9100] mt-1">فرصة تفعيل</p>
            </div>
            <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
              <MessageSquare className="w-4 h-4 text-[#00b0ff] mb-2" />
              <p className="text-[10px] text-[#607d8b] font-bold">رسائل صادرة آخر 30 يوم</p>
              <p className="text-xl font-black text-white mt-1">{formatNumber(operations.messagesSentLast30)}</p>
            </div>
            <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
              <MessageSquare className="w-4 h-4 text-[#ff9100] mb-2" />
              <p className="text-[10px] text-[#607d8b] font-bold">رسائل الصندوق آخر 30 يوم</p>
              <p className="text-xl font-black text-white mt-1">{formatNumber(operations.inboxMessagesLast30)}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="glass-card flex flex-col gap-4 border-[rgba(255,145,0,0.06)]">
          <h2 className="text-base font-bold text-white">آخر العملاء الذين دفعوا</h2>
          {lists.recentSuccessfulPayments.length === 0 ? (
            <EmptyState text="لا توجد مدفوعات ناجحة بعد." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[#607d8b]">
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <th className="py-3 font-bold text-right">العميل</th>
                    <th className="py-3 font-bold text-right">الباقة</th>
                    <th className="py-3 font-bold text-right">القيمة</th>
                    <th className="py-3 font-bold text-right">تأكيد الدفع</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.recentSuccessfulPayments.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-[rgba(255,255,255,0.04)] last:border-0">
                      <td className="py-3 text-white font-bold">{displayUser(tx.user)}</td>
                      <td className="py-3 text-[#90a4ae]">{tx.plan}</td>
                      <td className="py-3 text-[#00ffa7] font-black">{formatCurrency(tx.amount)}</td>
                      <td className="py-3 text-[#607d8b]">{formatDate(tx.confirmedAt || tx.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="glass-card flex flex-col gap-4 border-[rgba(255,145,0,0.06)]">
          <h2 className="text-base font-bold text-white">مدفوعات معلقة تحتاج متابعة</h2>
          {lists.pendingPayments.length === 0 ? (
            <EmptyState text="لا توجد مدفوعات معلقة حالياً." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[#607d8b]">
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <th className="py-3 font-bold text-right">العميل</th>
                    <th className="py-3 font-bold text-right">الباقة</th>
                    <th className="py-3 font-bold text-right">القيمة</th>
                    <th className="py-3 font-bold text-right">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.pendingPayments.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-[rgba(255,255,255,0.04)] last:border-0">
                      <td className="py-3 text-white font-bold">{displayUser(tx.user)}</td>
                      <td className="py-3 text-[#90a4ae]">{tx.plan}</td>
                      <td className="py-3 text-[#ff9100] font-black">{formatCurrency(tx.amount)}</td>
                      <td className="py-3 text-[#607d8b]">{formatDate(tx.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="glass-card flex flex-col gap-4 border-[rgba(255,145,0,0.06)]">
          <h2 className="text-base font-bold text-white">تجارب انتهت بدون دفع</h2>
          {lists.expiredTrials.length === 0 ? (
            <EmptyState text="لا توجد تجارب منتهية بدون دفع." />
          ) : (
            <div className="flex flex-col divide-y divide-[rgba(255,255,255,0.05)]">
              {lists.expiredTrials.map((user: any) => (
                <div key={user.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="text-right min-w-0">
                    <p className="text-xs font-bold text-white truncate">{displayUser(user)}</p>
                    <p className="text-[10px] text-[#607d8b] mt-1">{formatNumber(user._count.instances)} رقم واتساب | {formatNumber(user._count.transactions)} طلب دفع</p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="text-[10px] text-red-400 font-bold">انتهت التجربة</p>
                    <p className="text-[10px] text-[#607d8b] mt-1">{formatDate(user.trial?.endDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass-card flex flex-col gap-4 border-[rgba(255,145,0,0.06)]">
          <h2 className="text-base font-bold text-white">اشتراكات تنتهي قريباً</h2>
          {lists.expiringSoon.length === 0 ? (
            <EmptyState text="لا توجد اشتراكات مدفوعة تنتهي خلال 7 أيام." />
          ) : (
            <div className="flex flex-col divide-y divide-[rgba(255,255,255,0.05)]">
              {lists.expiringSoon.map((sub: any) => {
                const remaining = daysUntil(sub.endDate);
                return (
                  <div key={sub.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="text-right min-w-0">
                      <p className="text-xs font-bold text-white truncate">{displayUser(sub.user)}</p>
                      <p className="text-[10px] text-[#90a4ae] mt-1">{sub.plan}</p>
                    </div>
                    <div className="text-left flex-shrink-0">
                      <p className="text-[10px] text-[#ff9100] font-bold">متبقي {formatNumber(remaining)} يوم</p>
                      <p className="text-[10px] text-[#607d8b] mt-1">{formatDate(sub.endDate)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass-card flex flex-col gap-4 border-[rgba(255,145,0,0.06)]">
          <h2 className="text-base font-bold text-white">أحدث التسجيلات</h2>
          {lists.recentRegistrations.length === 0 ? (
            <EmptyState text="لا توجد تسجيلات بعد." />
          ) : (
            <div className="flex flex-col divide-y divide-[rgba(255,255,255,0.05)]">
              {lists.recentRegistrations.map((user: any) => (
                <div key={user.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="text-right min-w-0">
                    <p className="text-xs font-bold text-white truncate">{displayUser(user)}</p>
                    <p className="text-[10px] text-[#607d8b] mt-1">{user.subscription?.plan || 'بدون اشتراك'} | {formatNumber(user._count.instances)} رقم</p>
                  </div>
                  <p className="text-[10px] text-[#607d8b] flex-shrink-0">{formatDate(user.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
