'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  TrendingUp, 
  Activity, 
  Plus, 
  ArrowLeft,
  ChevronLeft,
  MessageCircle,
  Inbox,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import MonthlyUsageMeter from '@/components/monthly-usage-meter';

export default function DashboardHome() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard/stats');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed to fetch dashboard statistics.');
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ffa7] to-[#00b0ff] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#060b11] animate-spin" />
          </div>
          <span className="text-xs text-[#90a4ae]">جاري تحميل البيانات...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-3">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const { stats, recentLogs } = data;

  return (
    <div className="flex flex-col gap-8 text-right animate-fade-in">
      {/* Greeting Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">لوحة التحكم الرئيسية</h1>
        <p className="text-xs text-[#90a4ae] mt-1">مرحباً بك مجدداً! إليك لمحة عامة عن نشاط حسابك وأداء الخدمة.</p>
      </div>

      <MonthlyUsageMeter />

      {/* Grid Statistics widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat 1 */}
        <div className="glass-card flex items-center justify-between">
          <div className="w-12 h-12 rounded-xl bg-[#00ffa7]/10 flex items-center justify-center border border-[#00ffa7]/20 text-[#00ffa7]">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-[#607d8b] font-semibold">الأرقام النشطة</span>
            <h3 className="text-2xl font-black text-white mt-1">
              {stats.activeInstances} <span className="text-xs text-[#607d8b] font-normal">/ {stats.totalInstances}</span>
            </h3>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="glass-card flex items-center justify-between">
          <div className="w-12 h-12 rounded-xl bg-[#00b0ff]/10 flex items-center justify-center border border-[#00b0ff]/20 text-[#00b0ff]">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-[#607d8b] font-semibold">الرسائل المرسلة</span>
            <h3 className="text-2xl font-black text-white mt-1">{stats.messagesSent}</h3>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="glass-card flex items-center justify-between">
          <div className="w-12 h-12 rounded-xl bg-[#ff9100]/10 flex items-center justify-center border border-[#ff9100]/20 text-[#ff9100]">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-[#607d8b] font-semibold">الرسائل المستلمة</span>
            <h3 className="text-2xl font-black text-white mt-1">{stats.messagesReceived}</h3>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="glass-card flex items-center justify-between">
          <div className="w-12 h-12 rounded-xl bg-[#00ffa7]/10 flex items-center justify-center border border-[#00ffa7]/20 text-[#00ffa7] animate-pulse">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-[#607d8b] font-semibold">حالة الخدمة</span>
            <h3 className="text-lg font-black text-[#00ffa7] mt-1.5 flex items-center gap-1.5 justify-end">
              ممتازة
              <span className="indicator-online"></span>
            </h3>
          </div>
        </div>
      </div>

      {/* Main Content Actions + Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Quick Actions */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card flex flex-col gap-4">
            <h3 className="text-base font-bold text-white">إجراءات سريعة</h3>
            <hr className="border-[rgba(255,255,255,0.04)]" />
            <div className="flex flex-col gap-3">
              <Link 
                href="/dashboard/instances"
                className="btn-primary py-3 w-full justify-center text-xs font-bold"
              >
                ربط رقم جديد
                <Plus className="w-4 h-4 ml-1" />
              </Link>
              <Link 
                href="/dashboard/campaigns"
                className="btn-secondary py-3 w-full justify-center text-xs font-bold"
              >
                إنشاء حملة إرسال جماعي
              </Link>
              <Link 
                href="/dashboard/chatbot"
                className="btn-secondary py-3 w-full justify-center text-xs font-bold"
              >
                إعداد الشات بوت
              </Link>
            </div>
          </div>
        </div>

        {/* Right column: Recent Logs */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="glass-card flex flex-col gap-5">
            <div className="flex w-full items-center justify-between" dir="rtl">
              <h3 className="text-base font-bold text-white">سجل الرسائل الأخيرة</h3>
              <Link href="/dashboard/logs" className="text-xs text-[#00ffa7] hover:underline flex items-center gap-1">
                عرض السجل الكامل
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>
            <hr className="border-[rgba(255,255,255,0.04)]" />

            {recentLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#607d8b] font-semibold">
                لا يوجد أي رسائل مسجلة حتى الآن.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[rgba(255,255,255,0.04)] text-[#607d8b] font-bold">
                      <th className="pb-3">الرقم المرسل إليه</th>
                      <th className="pb-3">المحتوى</th>
                      <th className="pb-3 text-center">النوع</th>
                      <th className="pb-3 text-center">الجلسة</th>
                      <th className="pb-3 text-left">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map((log: any, idx: number) => (
                      <tr 
                        key={idx} 
                        className="border-b border-[rgba(255,255,255,0.03)] text-[#90a4ae] hover:text-white hover:bg-white/[0.01] transition-all"
                      >
                        <td className="py-4 font-semibold">{log.number}</td>
                        <td className="py-4 max-w-[200px] truncate" title={log.text}>{log.text}</td>
                        <td className="py-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            log.type === 'SENT' 
                              ? 'bg-[#00b0ff]/10 text-[#00b0ff]' 
                              : 'bg-[#00ffa7]/10 text-[#00ffa7]'
                          }`}>
                            {log.type === 'SENT' ? 'صادرة' : 'واردة'}
                          </span>
                        </td>
                        <td className="py-4 text-center">{log.instanceName}</td>
                        <td className="py-4 text-left font-mono text-[10px] text-[#607d8b]" suppressHydrationWarning>
                          {new Date(log.createdAt).toLocaleString('ar-EG')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
