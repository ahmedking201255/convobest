'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bot,
  FileSpreadsheet,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Send,
  ShoppingBag,
  Smartphone,
  TimerReset,
  Wallet
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

function formatStatus(status?: string | null) {
  const map: Record<string, string> = {
    CONNECTED: 'متصل',
    DISCONNECTED: 'غير متصل',
    ACTIVE: 'نشط',
    EXPIRED: 'منتهي',
    CANCELLED: 'ملغي',
    SUCCESSFUL: 'مدفوع',
    PENDING: 'معلق',
    FAILED: 'فشل',
    SENT: 'تم الإرسال',
    RECEIVED: 'وارد',
    DELIVERED: 'تم التسليم',
    READ: 'مقروء',
    RUNNING: 'قيد التشغيل',
    COMPLETED: 'مكتملة',
    PAUSED: 'متوقفة'
  };
  return map[status || ''] || status || 'غير محدد';
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
    <div className="glass-card flex items-center justify-between gap-4">
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

export default function CustomerReportsPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    try {
      setError('');
      const res = await fetch('/api/dashboard/reports', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'تعذر تحميل تقارير الحساب.');
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'تعذر تحميل تقارير الحساب.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const maxSeries = useMemo(() => {
    const series = report?.messages?.series || [];
    return Math.max(...series.map((item: any) => item.sent + item.received + item.failed), 1);
  }, [report]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ffa7] to-[#00b0ff] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#060b11] animate-spin" />
          </div>
          <span className="text-xs text-[#90a4ae]">جاري تجهيز تقارير حسابك...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const account = report.account;
  const usage = report.usage;
  const whatsapp = report.whatsapp;
  const messages = report.messages;
  const campaigns = report.campaigns;
  const billing = report.billing;
  const automation = report.automation;
  const connectedRatio = whatsapp.totalInstances
    ? Math.round((whatsapp.connectedInstances / whatsapp.totalInstances) * 100)
    : 0;
  const deliveryPool = messages.sentTotal + messages.failedTotal;
  const successRatio = deliveryPool ? Math.round((messages.sentTotal / deliveryPool) * 100) : 100;

  return (
    <div className="flex flex-col gap-8 text-right animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">تقارير حسابي</h1>
          <p className="text-xs text-[#90a4ae] mt-1">
            تحليل شامل لحسابك، أرقام واتساب، الرسائل، الحملات، التكاملات، والاشتراك.
          </p>
        </div>
        <button
          onClick={fetchReport}
          className="self-start md:self-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#00ffa7]/20 bg-[#00ffa7]/10 text-[#00ffa7] text-xs font-bold hover:bg-[#00ffa7]/15 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث التقارير
        </button>
      </div>

      <section className="glass-card flex flex-col md:flex-row md:items-center justify-between gap-5 border-l-4 border-l-[#00ffa7] bg-[#00ffa7]/5">
        <div>
          <p className="text-xs text-[#607d8b] font-bold">الحساب الحالي</p>
          <h2 className="text-xl font-black text-white mt-1">{account.name || account.email}</h2>
          <p className="text-[11px] text-[#90a4ae] mt-1">تاريخ التسجيل: {formatDate(account.createdAt)}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
          <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] px-4 py-3">
            <p className="text-[10px] text-[#607d8b] font-bold">الباقة</p>
            <p className="text-sm font-black text-[#00ffa7] mt-1">{account.subscription?.plan || 'لا توجد باقة'}</p>
          </div>
          <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] px-4 py-3">
            <p className="text-[10px] text-[#607d8b] font-bold">حالة الاشتراك</p>
            <p className="text-sm font-black text-white mt-1">{formatStatus(account.subscription?.status)}</p>
          </div>
          <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] px-4 py-3">
            <p className="text-[10px] text-[#607d8b] font-bold">متبقي</p>
            <p className={`text-sm font-black mt-1 ${(account.subscriptionDaysRemaining || 0) <= 7 ? 'text-[#ff9100]' : 'text-white'}`}>
              {account.subscriptionDaysRemaining === null ? 'غير محدد' : `${formatNumber(Math.max(account.subscriptionDaysRemaining, 0))} يوم`}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard
          title="استخدام الشهر"
          value={`${formatNumber(usage.used)} / ${formatNumber(usage.limit)}`}
          hint={`${formatNumber(usage.remaining)} رسالة متبقية في ${usage.period}`}
          icon={Send}
          tone="green"
        />
        <StatCard
          title="أرقام واتساب"
          value={`${formatNumber(whatsapp.connectedInstances)} / ${formatNumber(whatsapp.totalInstances)}`}
          hint={`${connectedRatio}% من أرقامك متصلة حالياً`}
          icon={Smartphone}
          tone="blue"
        />
        <StatCard
          title="محادثات وجهات اتصال"
          value={formatNumber(whatsapp.chatContacts)}
          hint={`${formatNumber(whatsapp.privateChats)} عملاء | ${formatNumber(whatsapp.groupChats)} مجموعات`}
          icon={MessageCircle}
          tone="orange"
        />
        <StatCard
          title="إجمالي المدفوع"
          value={formatCurrency(billing.paidTotal)}
          hint={`${formatNumber(billing.pendingTransactions)} عملية دفع معلقة`}
          icon={Wallet}
          tone="gray"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-7 glass-card flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">أداء الرسائل</h2>
              <p className="text-[11px] text-[#607d8b] mt-1">حركة الرسائل آخر 14 يوم ونسبة نجاح الإرسال.</p>
            </div>
            <BarChart3 className="w-5 h-5 text-[#00b0ff]" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
              <p className="text-[10px] text-[#607d8b] font-bold">صادرة</p>
              <p className="text-xl font-black text-[#00ffa7] mt-1">{formatNumber(messages.sentTotal)}</p>
            </div>
            <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
              <p className="text-[10px] text-[#607d8b] font-bold">واردة</p>
              <p className="text-xl font-black text-[#00b0ff] mt-1">{formatNumber(messages.receivedTotal)}</p>
            </div>
            <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
              <p className="text-[10px] text-[#607d8b] font-bold">فشلت</p>
              <p className="text-xl font-black text-red-400 mt-1">{formatNumber(messages.failedTotal)}</p>
            </div>
            <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
              <p className="text-[10px] text-[#607d8b] font-bold">نسبة النجاح</p>
              <p className="text-xl font-black text-white mt-1">{formatNumber(successRatio)}%</p>
            </div>
          </div>

          <div className="h-56 flex items-end gap-2 border-b border-[rgba(255,255,255,0.06)] pb-3">
            {messages.series.map((item: any) => {
              const total = item.sent + item.received + item.failed;
              const height = Math.max((total / maxSeries) * 100, total > 0 ? 10 : 3);
              return (
                <div key={item.date} className="flex-1 h-full flex flex-col justify-end items-center gap-2 min-w-0">
                  <div className="text-[10px] text-[#90a4ae] font-bold">{formatNumber(total)}</div>
                  <div className="w-full max-w-8 rounded-t-lg bg-gradient-to-t from-[#00b0ff] via-[#00ffa7] to-[#ff9100]" style={{ height: `${height}%` }} />
                  <div className="text-[9px] text-[#607d8b] truncate w-full text-center">{item.date.slice(5)}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-5 glass-card flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">حد الإرسال الشهري</h2>
              <p className="text-[11px] text-[#607d8b] mt-1">مراقبة استهلاك باقتك الحالية.</p>
            </div>
            <TimerReset className="w-5 h-5 text-[#00ffa7]" />
          </div>

          <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[#90a4ae] font-bold">{usage.plan || 'بدون باقة'}</span>
              <span className="text-xs text-white font-black">{Math.round(usage.percentage)}%</span>
            </div>
            <div className="h-3 rounded-full bg-[#07090e] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-[#00ffa7] to-[#00b0ff]" style={{ width: `${Math.min(usage.percentage, 100)}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 text-center">
              <div>
                <p className="text-[10px] text-[#607d8b] font-bold">المستخدم</p>
                <p className="text-sm text-white font-black">{formatNumber(usage.used)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#607d8b] font-bold">المتبقي</p>
                <p className="text-sm text-[#00ffa7] font-black">{formatNumber(usage.remaining)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#607d8b] font-bold">الحد</p>
                <p className="text-sm text-white font-black">{formatNumber(usage.limit)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
              <p className="text-[10px] text-[#607d8b] font-bold">صادر آخر 30 يوم</p>
              <p className="text-xl font-black text-[#00ffa7] mt-1">{formatNumber(messages.sentLast30)}</p>
            </div>
            <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
              <p className="text-[10px] text-[#607d8b] font-bold">وارد آخر 30 يوم</p>
              <p className="text-xl font-black text-[#00b0ff] mt-1">{formatNumber(messages.receivedLast30)}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-6 glass-card flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">الحملات</h2>
              <p className="text-[11px] text-[#607d8b] mt-1">حالة حملاتك ومصير المستلمين.</p>
            </div>
            <Send className="w-5 h-5 text-[#00ffa7]" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['الإجمالي', campaigns.total, 'text-white'],
              ['مكتملة', campaigns.status.completed, 'text-[#00ffa7]'],
              ['قيد التشغيل', campaigns.status.running, 'text-[#00b0ff]'],
              ['متوقفة', campaigns.status.paused, 'text-[#ff9100]']
            ].map(([label, value, cls]) => (
              <div key={String(label)} className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
                <p className="text-[10px] text-[#607d8b] font-bold">{label}</p>
                <p className={`text-xl font-black mt-1 ${cls}`}>{formatNumber(value)}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl bg-[#07090e] border border-[rgba(255,255,255,0.04)] p-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] text-[#607d8b] font-bold">مستلمين مرسل لهم</p>
              <p className="text-sm text-[#00ffa7] font-black">{formatNumber(campaigns.recipients.sent)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#607d8b] font-bold">قيد الانتظار</p>
              <p className="text-sm text-[#ff9100] font-black">{formatNumber(campaigns.recipients.pending)}</p>
            </div>
            <div>
              <p className="text-[10px] text-[#607d8b] font-bold">فشل</p>
              <p className="text-sm text-red-400 font-black">{formatNumber(campaigns.recipients.failed)}</p>
            </div>
          </div>
        </section>

        <section className="lg:col-span-6 glass-card flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">التكاملات والأتمتة</h2>
              <p className="text-[11px] text-[#607d8b] mt-1">حالة الربط مع المتجر والجداول والقواعد.</p>
            </div>
            <Bot className="w-5 h-5 text-[#00b0ff]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
              <ShoppingBag className="w-4 h-4 text-[#ff9100] mb-2" />
              <p className="text-[10px] text-[#607d8b] font-bold">ووكومرس</p>
              <p className="text-xl font-black text-white">{formatNumber(automation.woocommerce.enabled)} / {formatNumber(automation.woocommerce.total)}</p>
            </div>
            <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
              <FileSpreadsheet className="w-4 h-4 text-[#00ffa7] mb-2" />
              <p className="text-[10px] text-[#607d8b] font-bold">Google Sheets</p>
              <p className="text-xl font-black text-white">{formatNumber(automation.googleSheets.enabled)} / {formatNumber(automation.googleSheets.total)}</p>
            </div>
            <div className="rounded-xl bg-[#0c0f16] border border-[rgba(255,255,255,0.05)] p-4">
              <MessageSquare className="w-4 h-4 text-[#00b0ff] mb-2" />
              <p className="text-[10px] text-[#607d8b] font-bold">قواعد الكلمات النشطة</p>
              <p className="text-xl font-black text-white">{formatNumber(automation.keywordRules.enabled)} / {formatNumber(automation.keywordRules.total)}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="glass-card flex flex-col gap-4">
          <h2 className="text-base font-bold text-white">أرقام واتساب في الحساب</h2>
          {whatsapp.instances.length === 0 ? (
            <EmptyState text="لم تقم بربط أي رقم واتساب بعد." />
          ) : (
            <div className="flex flex-col divide-y divide-[rgba(255,255,255,0.05)]">
              {whatsapp.instances.map((instance: any) => (
                <div key={instance.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="text-right min-w-0">
                    <p className="text-xs font-bold text-white truncate">{instance.name}</p>
                    <p className="text-[10px] text-[#607d8b] mt-1">{instance.jid || 'لم يتم تحديد رقم واتساب'}</p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className={`text-[10px] font-bold ${instance.status === 'CONNECTED' ? 'text-[#00ffa7]' : 'text-[#ff9100]'}`}>
                      {formatStatus(instance.status)}
                    </p>
                    <p className="text-[10px] text-[#607d8b] mt-1">{formatNumber(instance._count.logs)} رسالة سجل</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass-card flex flex-col gap-4">
          <h2 className="text-base font-bold text-white">المعاملات والفوترة</h2>
          {billing.recentTransactions.length === 0 ? (
            <EmptyState text="لا توجد معاملات دفع مسجلة بعد." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[#607d8b]">
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    <th className="py-3 font-bold text-right">الباقة</th>
                    <th className="py-3 font-bold text-right">القيمة</th>
                    <th className="py-3 font-bold text-right">الحالة</th>
                    <th className="py-3 font-bold text-right">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.recentTransactions.map((tx: any) => (
                    <tr key={tx.id} className="border-b border-[rgba(255,255,255,0.04)] last:border-0">
                      <td className="py-3 text-white font-bold">{tx.plan}</td>
                      <td className="py-3 text-[#00ffa7] font-black">{formatCurrency(tx.amount)}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          tx.status === 'SUCCESSFUL' ? 'bg-[#00ffa7]/10 text-[#00ffa7]' :
                          tx.status === 'PENDING' ? 'bg-[#ff9100]/10 text-[#ff9100]' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {formatStatus(tx.status)}
                        </span>
                      </td>
                      <td className="py-3 text-[#607d8b]">{formatDate(tx.confirmedAt || tx.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="glass-card flex flex-col gap-4">
          <h2 className="text-base font-bold text-white">أحدث الحملات</h2>
          {campaigns.recent.length === 0 ? (
            <EmptyState text="لا توجد حملات إرسال بعد." />
          ) : (
            <div className="flex flex-col divide-y divide-[rgba(255,255,255,0.05)]">
              {campaigns.recent.map((campaign: any) => (
                <div key={campaign.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="text-right min-w-0">
                    <p className="text-xs font-bold text-white truncate">{campaign.name}</p>
                    <p className="text-[10px] text-[#607d8b] mt-1">{campaign.instance?.name || 'رقم غير محدد'} | {formatNumber(campaign._count.recipients)} مستلم</p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="text-[10px] text-[#00b0ff] font-bold">{formatStatus(campaign.status)}</p>
                    <p className="text-[10px] text-[#607d8b] mt-1">{formatDate(campaign.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="glass-card flex flex-col gap-4">
          <h2 className="text-base font-bold text-white">آخر حركات الرسائل</h2>
          {report.recentLogs.length === 0 ? (
            <EmptyState text="لا توجد رسائل مسجلة حتى الآن." />
          ) : (
            <div className="flex flex-col divide-y divide-[rgba(255,255,255,0.05)]">
              {report.recentLogs.map((log: any) => (
                <div key={log.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="text-right min-w-0">
                    <p className="text-xs font-bold text-white truncate">{log.number}</p>
                    <p className="text-[10px] text-[#90a4ae] mt-1 truncate max-w-[340px]">{log.text}</p>
                    <p className="text-[10px] text-[#607d8b] mt-1">{log.instanceName}</p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className={`text-[10px] font-bold ${log.type === 'SENT' ? 'text-[#00ffa7]' : log.type === 'FAILED' ? 'text-red-400' : 'text-[#00b0ff]'}`}>
                      {formatStatus(log.type)}
                    </p>
                    <p className="text-[10px] text-[#607d8b] mt-1">{formatDate(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
