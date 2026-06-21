'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MessageCircle, 
  Send, 
  Inbox, 
  AlertTriangle, 
  Activity, 
  CreditCard,
  Layers,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardHome() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchAdminStats() {
      try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch admin statistics.');
        setStats(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAdminStats();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff9100] to-[#ff3d00] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#060b11] animate-spin" />
          </div>
          <span className="text-xs text-[#90a4ae]">جاري تحميل إحصائيات النظام العامة...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 text-right animate-fade-in">
      {/* Overview Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">نظرة عامة على المنصة</h1>
        <p className="text-xs text-[#90a4ae] mt-1">تجد هنا التحليلات الكاملة للمشتركين والموارد المستهلكة عبر النظام بالكامل.</p>
      </div>

      {/* Grid Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Stat 1: Total Users */}
        <div className="glass-card flex items-center justify-between border-[rgba(255,145,0,0.06)] hover:border-[#ff9100]/20">
          <div className="w-12 h-12 rounded-xl bg-[#ff9100]/10 flex items-center justify-center border border-[#ff9100]/20 text-[#ff9100]">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-[#607d8b] font-semibold">إجمالي المستخدمين</span>
            <h3 className="text-2xl font-black text-white mt-1">{stats.totalUsers}</h3>
          </div>
        </div>

        {/* Stat 2: Active Instances */}
        <div className="glass-card flex items-center justify-between border-[rgba(255,145,0,0.06)] hover:border-[#ff9100]/20">
          <div className="w-12 h-12 rounded-xl bg-[#00ffa7]/10 flex items-center justify-center border border-[#00ffa7]/20 text-[#00ffa7]">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-[#607d8b] font-semibold">المثيلات النشطة</span>
            <h3 className="text-2xl font-black text-white mt-1">
              {stats.activeInstances} <span className="text-xs text-[#607d8b] font-normal">/ {stats.totalInstances}</span>
            </h3>
          </div>
        </div>

        {/* Stat 3: Messages Sent */}
        <div className="glass-card flex items-center justify-between border-[rgba(255,145,0,0.06)] hover:border-[#ff9100]/20">
          <div className="w-12 h-12 rounded-xl bg-[#00b0ff]/10 flex items-center justify-center border border-[#00b0ff]/20 text-[#00b0ff]">
            <Send className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-[#607d8b] font-semibold">إجمالي الرسائل المرسلة</span>
            <h3 className="text-2xl font-black text-white mt-1">{stats.messagesSent}</h3>
          </div>
        </div>

        {/* Stat 4: Messages Received */}
        <div className="glass-card flex items-center justify-between border-[rgba(255,145,0,0.06)] hover:border-[#ff9100]/20">
          <div className="w-12 h-12 rounded-xl bg-[#ff3d00]/10 flex items-center justify-center border border-[#ff3d00]/20 text-[#ff3d00]">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-[#607d8b] font-semibold">إجمالي الرسائل المستلمة</span>
            <h3 className="text-2xl font-black text-white mt-1">{stats.messagesReceived}</h3>
          </div>
        </div>
      </div>

      {/* Detailed Section: Subscription distribution & quick routes */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Subscriptions Plans breakdown */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="glass-card flex flex-col gap-5 border-[rgba(255,145,0,0.06)]">
            <h3 className="text-base font-bold text-white">تقسيم الاشتراكات الفعالة</h3>
            <hr className="border-[rgba(255,255,255,0.04)]" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {/* Starter Pack */}
              <div className="bg-[#0c0f16] border border-[rgba(255,255,255,0.04)] rounded-xl p-5 text-right">
                <span className="text-[10px] bg-[#607d8b]/15 text-[#90a4ae] px-2 py-0.5 rounded-full font-bold">Starter</span>
                <h4 className="text-2xl font-black text-white mt-2">{stats.subscriptions.starter}</h4>
                <p className="text-[10px] text-[#607d8b] mt-1">اشتراكات فعالة</p>
              </div>

              {/* Pro Pack */}
              <div className="bg-[#0c0f16] border border-[#00ffa7]/10 rounded-xl p-5 text-right">
                <span className="text-[10px] bg-[#00ffa7]/10 text-[#00ffa7] px-2 py-0.5 rounded-full font-bold">Pro</span>
                <h4 className="text-2xl font-black text-white mt-2">{stats.subscriptions.pro}</h4>
                <p className="text-[10px] text-[#607d8b] mt-1">اشتراكات فعالة</p>
              </div>

              {/* Enterprise Pack */}
              <div className="bg-[#0c0f16] border border-[#00b0ff]/10 rounded-xl p-5 text-right">
                <span className="text-[10px] bg-[#00b0ff]/10 text-[#00b0ff] px-2 py-0.5 rounded-full font-bold">Enterprise</span>
                <h4 className="text-2xl font-black text-white mt-2">{stats.subscriptions.enterprise}</h4>
                <p className="text-[10px] text-[#607d8b] mt-1">اشتراكات فعالة</p>
              </div>
            </div>

            <div className="bg-[#07090e] rounded-xl p-4 flex items-center justify-between border border-[rgba(255,255,255,0.02)] mt-2">
              <span className="text-xs text-[#90a4ae] font-semibold">إجمالي الاشتراكات النشطة حالياً:</span>
              <span className="text-sm font-bold text-white">{stats.subscriptions.totalActive} اشتراك</span>
            </div>
          </div>
        </div>

        {/* Quick Actions / Shortcuts */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card flex flex-col gap-4 border-[rgba(255,145,0,0.06)]">
            <h3 className="text-base font-bold text-white">إجراءات المسؤول السريعة</h3>
            <hr className="border-[rgba(255,255,255,0.04)]" />
            <div className="flex flex-col gap-3">
              <Link 
                href="/admin/users"
                className="btn-primary py-3 w-full justify-center text-xs font-bold bg-gradient-to-r from-[#ff9100] to-[#ff3d00] text-white! border-none shadow-[#ff9100]/10 hover:shadow-[#ff9100]/25"
              >
                إدارة المستخدمين والاشتراكات
                <Layers className="w-4 h-4 ml-1" />
              </Link>

              <Link 
                href="/dashboard"
                className="btn-secondary py-3 w-full justify-center text-xs font-bold"
              >
                الدخول كعميل (لوحة العميل)
                <ArrowRight className="w-4 h-4 mr-1 text-[#00ffa7]" />
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
