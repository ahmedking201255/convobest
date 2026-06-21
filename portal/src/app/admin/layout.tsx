'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Users, 
  ArrowLeft, 
  LogOut, 
  User, 
  Menu, 
  X,
  ShieldAlert,
  Settings,
  BarChart3
} from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch session and verify Admin role
  useEffect(() => {
    async function verifyAdmin() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        
        if (!res.ok || !data.authenticated) {
          router.push('/login');
          return;
        }

        if (data.user.role !== 'ADMIN') {
          // Redirect standard users to client dashboard
          router.push('/dashboard');
          return;
        }
        
        setUser(data.user);
      } catch (err) {
        console.error(err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    verifyAdmin();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error(err);
    }
  };

  const adminMenuItems = [
    { name: 'الإحصائيات العامة', icon: LayoutDashboard, path: '/admin' },
    { name: 'تقارير الإدارة', icon: BarChart3, path: '/admin/reports' },
    { name: 'إدارة المستخدمين والاشتراكات', icon: Users, path: '/admin/users' },
    { name: 'إعدادات النظام', icon: Settings, path: '/admin/settings' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060b11] flex items-center justify-center">
        <div className="bg-grid"></div>
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#ff9100] to-[#ff3d00] flex items-center justify-center shadow-lg shadow-[#ff9100]/15">
            <ShieldAlert className="w-8 h-8 text-[#060b11]" />
          </div>
          <span className="text-sm text-[#90a4ae] font-bold">جاري التحقق من صلاحيات المسؤول...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] bg-[#060b11] flex overflow-hidden">
      <div className="bg-grid"></div>

      {/* --- Desktop Sidebar --- */}
      <aside className="hidden lg:flex flex-col w-[280px] bg-[#0c0f16]/95 border-l border-[rgba(255,145,0,0.15)] relative z-20 flex-shrink-0">
        {/* Brand */}
        <div className="h-[75px] px-6 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff9100] to-[#ff3d00] flex items-center justify-center shadow-lg shadow-[#ff9100]/15">
            <ShieldAlert className="w-4 h-4 text-[#060b11]" />
          </div>
          <div className="flex flex-col text-right">
            <span className="text-sm font-black text-white">إدارة ConvoBest</span>
            <span className="text-[9px] text-[#ff9100] font-bold tracking-widest uppercase">Admin Panel</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 flex flex-col gap-1.5 overflow-y-auto">
          {adminMenuItems.map((item, idx) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link 
                key={idx}
                href={item.path}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive 
                    ? 'bg-[#ff9100]/10 text-[#ff9100] border border-[#ff9100]/20' 
                    : 'text-[#90a4ae] hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#ff9100]' : ''}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}

          <hr className="border-[rgba(255,255,255,0.04)] my-3" />

          {/* Back to Client Area */}
          <Link 
            href="/dashboard"
            className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-semibold text-[#00ffa7] hover:bg-[#00ffa7]/5 border border-transparent hover:border-[#00ffa7]/10 transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-[#00ffa7]" />
            <span>لوحة العميل العادية</span>
          </Link>
        </nav>

        {/* Footer Info / Logout */}
        <div className="p-4 border-t border-[rgba(255,255,255,0.06)] bg-[#0c0f16]/55">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-[#121e2a] flex items-center justify-center border border-[rgba(255,255,255,0.06)]">
              <User className="w-4.5 h-4.5 text-[#607d8b]" />
            </div>
            <div className="overflow-hidden flex-1 text-right">
              <h4 className="text-xs font-bold text-white truncate">{user?.name || user?.email}</h4>
              <span className="text-[9px] text-[#ff9100] bg-[#ff9100]/10 px-2.5 py-0.5 rounded-full font-black mt-1 inline-block">
                مسؤول النظام
              </span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-[rgba(255,255,255,0.06)] hover:border-red-500/30 text-xs font-bold text-[#607d8b] hover:text-red-500 transition-all bg-transparent cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* --- Mobile Sidebar Overlay --- */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* --- Mobile Sidebar --- */}
      <aside className={`fixed top-0 bottom-0 right-0 w-[280px] bg-[#0c0f16] z-40 border-l border-[rgba(255,145,0,0.15)] flex flex-col transition-transform duration-300 transform lg:hidden ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="h-[75px] px-6 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#ff9100] to-[#ff3d00] flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-[#060b11]" />
            </div>
            <span className="text-base font-bold text-white">إدارة ConvoBest</span>
          </div>
          <button className="text-[#607d8b] hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 flex flex-col gap-1.5 overflow-y-auto">
          {adminMenuItems.map((item, idx) => {
            const isActive = pathname === item.path;
            const Icon = item.icon;
            return (
              <Link 
                key={idx}
                href={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive 
                    ? 'bg-[#ff9100]/10 text-[#ff9100] border border-[#ff9100]/20' 
                    : 'text-[#90a4ae] hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}

          <hr className="border-[rgba(255,255,255,0.04)] my-3" />

          <Link 
            href="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-semibold text-[#00ffa7] hover:bg-[#00ffa7]/5 transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-[#00ffa7]" />
            <span>لوحة العميل العادية</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-[rgba(255,255,255,0.06)] bg-[#0c0f16]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-[#121e2a] flex items-center justify-center">
              <User className="w-4 h-4 text-[#607d8b]" />
            </div>
            <div className="overflow-hidden flex-1 text-right">
              <h4 className="text-xs font-bold text-white truncate">{user?.name || user?.email}</h4>
              <span className="text-[9px] text-[#ff9100] bg-[#ff9100]/10 px-2 py-0.5 rounded-full font-black mt-1 inline-block">
                مسؤول النظام
              </span>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-[rgba(255,255,255,0.06)] text-xs font-bold text-[#607d8b] hover:text-red-500 transition-all bg-transparent"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* --- Main Content Wrapper --- */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {/* Header Bar */}
        <header className="h-[70px] border-b border-[rgba(255,255,255,0.06)] bg-[#060b11]/80 backdrop-blur-md flex items-center justify-between px-6 z-10 flex-shrink-0">
          <button 
            className="lg:hidden text-[#90a4ae] hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="hidden lg:block text-right">
            <h3 className="text-sm font-bold text-white">لوحة تحكم المسؤول</h3>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#121620] border border-[rgba(255,145,0,0.15)] rounded-xl px-4 py-1.5 text-xs text-[#ff9100] font-bold">
              <span>وضع المسؤول</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
