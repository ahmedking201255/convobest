'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Zap, 
  LayoutDashboard, 
  MessageSquare, 
  Bot, 
  Send, 
  ListFilter, 
  LogOut, 
  User, 
  Menu, 
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CreditCard,
  Terminal,
  MessageCircle,
  Inbox,
  ShoppingBag,
  FileSpreadsheet,
  BarChart3
} from 'lucide-react';
import MonthlyUsageMeter from '@/components/monthly-usage-meter';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch session on load
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        
        if (!res.ok || !data.authenticated) {
          router.push('/login');
          return;
        }
        
        const sessionUser = data.user;
        setUser(sessionUser);
        
        // Immediate redirection on mount if expired and not on billing page
        if (sessionUser && sessionUser.role !== 'ADMIN') {
          const isSubActive = sessionUser.subscription && sessionUser.subscription.status === 'ACTIVE';
          if (!isSubActive && pathname !== '/dashboard/billing') {
            router.replace('/dashboard/billing?expired=true');
            return;
          }
        }
      } catch (err) {
        console.error(err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [router, pathname]);

  // Client-side route guarding on pathname change
  useEffect(() => {
    if (loading || !user) return;
    
    if (user.role !== 'ADMIN') {
      const isSubActive = user.subscription && user.subscription.status === 'ACTIVE';
      if (!isSubActive && pathname !== '/dashboard/billing') {
        router.replace('/dashboard/billing?expired=true');
      }
    }
  }, [pathname, user, loading, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error(err);
    }
  };

  const menuItems = [
    { name: 'الرئيسية', icon: LayoutDashboard, path: '/dashboard' },
    { name: 'أرقام الواتساب', icon: MessageSquare, path: '/dashboard/instances' },
    { name: 'حملات الإرسال', icon: Send, path: '/dashboard/campaigns' },
    { name: 'الصندوق الوارد', icon: Inbox, path: '/dashboard/inbox' },
    { name: 'تقاريري', icon: BarChart3, path: '/dashboard/reports' },
    { name: 'الرد بالكلمات المفتاحية', icon: MessageCircle, path: '/dashboard/keywords' },
    { name: 'ربط ووكومرس', icon: ShoppingBag, path: '/dashboard/woocommerce' },
    { name: 'ربط جوجل شيتس', icon: FileSpreadsheet, path: '/dashboard/google-sheets' },
    { name: 'شات بوت الذكي (AI)', icon: Bot, path: '/dashboard/chatbot' },
    { name: 'الاشتراكات والفوترة', icon: CreditCard, path: '/dashboard/billing' },
    { name: 'سجل الرسائل', icon: ListFilter, path: '/dashboard/logs' },
    { name: 'توثيق الـ API', icon: Terminal, path: '/dashboard/api-docs' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060b11] flex items-center justify-center">
        <div className="bg-grid"></div>
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#00ffa7] to-[#00b0ff] flex items-center justify-center">
            <Zap className="w-8 h-8 text-[#060b11]" />
          </div>
          <span className="text-sm text-[#90a4ae] font-bold">جاري تحميل لوحة التحكم...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] bg-[#060b11] flex overflow-hidden">
      <div className="bg-grid"></div>

      {/* --- Desktop Sidebar --- */}
      <aside className="hidden lg:flex flex-col w-[280px] bg-[#0e1622]/95 border-l border-[rgba(255,255,255,0.06)] relative z-20 flex-shrink-0">
        {/* Brand */}
        <div className="h-[75px] px-6 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-3">
          <img src="/logo.png" alt="ConvoBest" className="w-9 h-9 rounded-xl shadow-lg shadow-[#00ffa7]/15" />
          <span className="text-lg font-black bg-gradient-to-r from-white via-white to-[#00ffa7] bg-clip-text text-transparent">ConvoBest</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 flex flex-col gap-1.5 overflow-y-auto">
          {menuItems.map((item, idx) => {
            const isBilling = item.path === '/dashboard/billing';
            const isSubActive = user?.subscription?.status === 'ACTIVE' || user?.role === 'ADMIN';
            const isLocked = !isBilling && !isSubActive;
            
            const isActive = pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link 
                key={idx}
                href={isLocked ? '/dashboard/billing?expired=true' : item.path}
                className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                  isLocked
                    ? 'text-[#607d8b]/50 hover:text-[#90a4ae]/60 border border-transparent cursor-not-allowed'
                    : isActive 
                      ? 'bg-[#00ffa7]/10 text-[#00ffa7] border border-[#00ffa7]/20' 
                      : 'text-[#90a4ae] hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className={`w-4 h-4 ${isActive && !isLocked ? 'text-[#00ffa7]' : ''}`} />
                  <span>{item.name}</span>
                </div>
                {isLocked && (
                  <span className="text-[9px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-md border border-red-500/15 font-bold">
                    مغلق
                  </span>
                )}
              </Link>
            );
          })}

          {user?.role === 'ADMIN' && (
            <>
              <hr className="border-[rgba(255,255,255,0.04)] my-3" />
              <Link 
                href="/admin"
                className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-bold text-[#ff9100] hover:bg-[#ff9100]/5 border border-transparent hover:border-[#ff9100]/10 transition-all"
              >
                <ShieldAlert className="w-4 h-4 text-[#ff9100]" />
                <span>لوحة الإدارة ⚙️</span>
              </Link>
            </>
          )}
        </nav>

        {/* Footer Info / Logout */}
        <div className="p-4 border-t border-[rgba(255,255,255,0.06)] bg-[#070d14]/55">
          <MonthlyUsageMeter compact />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-[#121e2a] flex items-center justify-center border border-[rgba(255,255,255,0.06)]">
              <User className="w-4.5 h-4.5 text-[#607d8b]" />
            </div>
            <div className="overflow-hidden flex-1 text-right">
              <h4 className="text-xs font-bold text-white truncate">{user?.name || user?.email}</h4>
              <span className="text-[10px] text-[#00ffa7] bg-[#00ffa7]/10 px-2 py-0.5 rounded-full font-black mt-1 inline-block">
                {user?.subscription?.plan || 'لا يوجد باقة'}
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
      <aside className={`fixed top-0 bottom-0 right-0 w-[280px] bg-[#0e1622] z-40 border-l border-[rgba(255,255,255,0.06)] flex flex-col transition-transform duration-300 transform lg:hidden ${
        sidebarOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="h-[75px] px-6 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ConvoBest" className="w-9 h-9 rounded-xl" />
            <span className="text-lg font-black text-white">ConvoBest</span>
          </div>
          <button className="text-[#607d8b] hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-1.5 overflow-y-auto">
          {menuItems.map((item, idx) => {
            const isBilling = item.path === '/dashboard/billing';
            const isSubActive = user?.subscription?.status === 'ACTIVE' || user?.role === 'ADMIN';
            const isLocked = !isBilling && !isSubActive;
            
            const isActive = pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link 
                key={idx}
                href={isLocked ? '/dashboard/billing?expired=true' : item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-semibold transition-all ${
                  isLocked
                    ? 'text-[#607d8b]/50 hover:text-[#90a4ae]/60 border border-transparent cursor-not-allowed'
                    : isActive 
                      ? 'bg-[#00ffa7]/10 text-[#00ffa7] border border-[#00ffa7]/20' 
                      : 'text-[#90a4ae] hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className={`w-4 h-4 ${isActive && !isLocked ? 'text-[#00ffa7]' : ''}`} />
                  <span>{item.name}</span>
                </div>
                {isLocked && (
                  <span className="text-[9px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded-md border border-red-500/15 font-bold">
                    مغلق
                  </span>
                )}
              </Link>
            );
          })}

          {user?.role === 'ADMIN' && (
            <>
              <hr className="border-[rgba(255,255,255,0.04)] my-3" />
              <Link 
                href="/admin"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-bold text-[#ff9100] hover:bg-[#ff9100]/5 border border-transparent hover:border-[#ff9100]/10 transition-all"
              >
                <ShieldAlert className="w-4 h-4 text-[#ff9100]" />
                <span>لوحة الإدارة ⚙️</span>
              </Link>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-[rgba(255,255,255,0.06)] bg-[#070d14]">
          <MonthlyUsageMeter compact />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-[#121e2a] flex items-center justify-center">
              <User className="w-4 h-4 text-[#607d8b]" />
            </div>
            <div className="overflow-hidden flex-1 text-right">
              <h4 className="text-xs font-bold text-white truncate">{user?.name || user?.email}</h4>
              <span className="text-[9px] text-[#00ffa7] bg-[#00ffa7]/10 px-2 py-0.5 rounded-full font-black mt-1 inline-block">
                {user?.subscription?.plan || 'لا يوجد باقة'}
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
            <h3 className="text-sm font-bold text-white">لوحة التحكم</h3>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick stats / Plan tag */}
            <div className="flex items-center gap-2 bg-[#0e1622] border border-[rgba(255,255,255,0.06)] rounded-xl px-4 py-1.5 text-xs text-[#90a4ae]">
              <span className="font-semibold">تاريخ الانتهاء:</span>
              <span className="text-white font-bold" suppressHydrationWarning>
                {user?.subscription?.endDate 
                  ? new Date(user.subscription.endDate).toLocaleDateString('ar-EG') 
                  : 'غير محدد'}
              </span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className={`flex-1 overflow-y-auto ${pathname === '/dashboard/inbox' ? 'p-0' : 'p-6 md:p-8'}`}>
          <div className={`${pathname === '/dashboard/inbox' ? 'max-w-none w-full' : 'max-w-6xl mx-auto'} h-full`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
