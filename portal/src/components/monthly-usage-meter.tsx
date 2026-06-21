'use client';

import React, { useEffect, useState } from 'react';
import { Activity, CalendarClock, Gauge, Send } from 'lucide-react';

type Usage = {
  plan: string | null;
  period: string;
  limit: number;
  used: number;
  remaining: number;
  percentage: number;
};

export default function MonthlyUsageMeter({ compact = false }: { compact?: boolean }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadUsage = async () => {
      try {
        const response = await fetch('/api/usage', { cache: 'no-store' });
        const data = await response.json();
        if (active && response.ok) setUsage(data.usage);
      } catch (error) {
        console.error('Failed to load monthly message usage:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadUsage();
    const interval = setInterval(loadUsage, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className={compact ? 'h-16 rounded-lg bg-white/[0.03] animate-pulse' : 'h-44 rounded-lg bg-white/[0.03] animate-pulse'} />
    );
  }

  if (!usage || usage.limit <= 0) return null;

  const percentage = Math.min(Math.max(usage.percentage, 0), 100);
  const accent = percentage >= 90 ? '#ef4444' : percentage >= 75 ? '#ff9100' : '#00ffa7';
  const number = new Intl.NumberFormat('ar-EG');

  if (compact) {
    return (
      <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.025] p-3" dir="rtl">
        <div className="mb-2 flex items-center justify-between gap-3 text-[10px]">
          <span className="font-bold text-white">الاستهلاك الشهري</span>
          <span className="font-mono font-bold" style={{ color: accent }}>{percentage.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percentage}%`, backgroundColor: accent }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-[#607d8b]">
          <span>{number.format(usage.used)} مستخدمة</span>
          <span>{number.format(usage.remaining)} متبقية</span>
        </div>
      </div>
    );
  }

  return (
    <section className="glass-card relative overflow-hidden border border-white/[0.06] bg-[#0b131d]" dir="rtl">
      <div className="absolute inset-y-0 right-0 w-1" style={{ backgroundColor: accent }} />
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[180px_1fr] lg:items-center">
        <div className="flex items-center justify-center">
          <div
            className="relative flex h-36 w-36 items-center justify-center rounded-full p-3"
            style={{ background: `conic-gradient(${accent} ${percentage * 3.6}deg, rgba(255,255,255,0.055) 0deg)` }}
          >
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-white/[0.06] bg-[#09111a] text-center">
              <Gauge className="mb-1 h-5 w-5" style={{ color: accent }} />
              <strong className="text-2xl font-black text-white">{percentage.toFixed(1)}%</strong>
              <span className="text-[9px] font-semibold text-[#607d8b]">من الحد الشهري</span>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Send className="h-4 w-4 text-[#00b0ff]" />
                <h2 className="text-base font-extrabold text-white">رصيد الإرسال الشهري</h2>
              </div>
              <p className="text-[10px] leading-relaxed text-[#90a4ae]">
                يتم احتساب كل رسالة صادرة عبر الصندوق الوارد، الحملات، API والتكاملات ضمن رصيد باقة {usage.plan}.
              </p>
            </div>
            <span className="w-fit rounded-full border border-white/[0.07] bg-white/[0.035] px-3 py-1 text-[10px] font-bold text-[#90a4ae]">
              يتجدد تلقائيا أول كل شهر
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <UsageStat label="تم استخدامها" value={number.format(usage.used)} color="#00b0ff" />
            <UsageStat label="متبقية" value={number.format(usage.remaining)} color={accent} />
            <UsageStat label="حد الباقة" value={number.format(usage.limit)} color="#ffffff" />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-[10px] font-semibold text-[#607d8b]">
              <span>0</span>
              <span>{number.format(usage.limit)} رسالة</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full border border-white/[0.04] bg-white/[0.045]">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${percentage}%`, backgroundColor: accent }} />
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-[#607d8b]">
            <CalendarClock className="h-3.5 w-3.5" />
            <span>فترة الاستخدام الحالية: {usage.period}</span>
            {percentage >= 90 && <span className="font-bold text-red-400">اقترب الرصيد من النفاد</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

function UsageStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-white/[0.055] bg-white/[0.025] px-4 py-3">
      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-semibold text-[#607d8b]">
        <Activity className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <strong className="text-lg font-black" style={{ color }}>{value}</strong>
    </div>
  );
}
