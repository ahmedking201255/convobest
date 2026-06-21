'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Bot, 
  Send, 
  ShieldCheck, 
  Users, 
  Zap, 
  Code, 
  Terminal, 
  Check, 
  ChevronDown, 
  ExternalLink,
  ArrowLeft,
  ArrowRight,
  Menu,
  X,
  Play,
  Copy,
  ShoppingBag,
  Database,
  LayoutDashboard,
  LogOut,
  AlertTriangle
} from 'lucide-react';

type LandingUser = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  subscription: {
    plan: string;
    status: string;
    endDate: string;
  } | null;
};

export default function Home() {
  const [activeTab, setActiveTab] = useState<'curl' | 'node' | 'python'>('curl');
  const [copied, setCopied] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot', text: string, time: string }>>([
    { sender: 'user', text: 'مرحباً، هل يمكنني تجربة نظام المحادثة الآلي؟', time: '10:00 ص' },
    { sender: 'bot', text: 'أهلاً بك! أنا شات بوت ذكي مدمج مع ConvoBest. أستطيع الرد تلقائياً وبسرعة فائقة ⚡', time: '10:01 ص' }
  ]);
  const [inputText, setInputText] = useState('تحديث حالة طلب الشحن رقم #1029');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<LandingUser | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [instances, setInstances] = useState<any[]>([]);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [apiError, setApiError] = useState('');
  const [apiSuccess, setApiSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);

    async function loadSession() {
      try {
        const response = await fetch('/api/auth/session', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json();

        if (active && response.ok && data.authenticated) {
          setCurrentUser(data.user);
          
          // Fetch user's WhatsApp instances
          try {
            const instRes = await fetch('/api/instances');
            if (instRes.ok) {
              const instData = await instRes.json();
              if (active) {
                setInstances(instData);
                const connected = instData.find((inst: any) => inst.status === 'CONNECTED');
                if (connected) {
                  setSelectedInstanceId(connected.id);
                } else if (instData.length > 0) {
                  setSelectedInstanceId(instData[0].id);
                }
              }
            }
          } catch (instErr) {
            console.error('Failed to load instances on landing page:', instErr);
          }
        }
      } catch (error) {
        console.error('Failed to load landing page session:', error);
      }
    }

    loadSession();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  // Auto scroll mockup messages to bottom
  useEffect(() => {
    const chatBody = document.getElementById('mock-chat-body');
    if (chatBody) {
      chatBody.scrollTop = chatBody.scrollHeight;
    }
  }, [messages]);

  const connectedInstances = instances.filter((inst: any) => inst.status === 'CONNECTED');

  const targetToken = currentUser && connectedInstances.length > 0 
    ? connectedInstances.find((inst: any) => inst.id === selectedInstanceId)?.token || connectedInstances[0].token 
    : 'YOUR_API_KEY';

  const targetNumber = recipientPhone.trim() || '201012345678';
  const targetText = inputText.trim() || 'مرحباً بك! هذه رسالة نصية مرسلة عبر الـ API الخاص بـ ConvoBest. 🚀';

  const codeSnippets = {
    curl: `curl -X POST "https://convobest.com/api/v1/send/text" \\
  -H "apikey: ${targetToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "number": "${targetNumber}",
    "text": "${targetText}"
  }'`,
    node: `const axios = require('axios');

axios.post('https://convobest.com/api/v1/send/text', {
  number: '${targetNumber}',
  text: '${targetText}'
}, {
  headers: {
    'apikey': '${targetToken}',
    'Content-Type': 'application/json'
  }
})
.then(response => console.log('تم الإرسال:', response.data))
.catch(error => console.error(error));`,
    python: `import requests

url = "https://convobest.com/api/v1/send/text"
headers = {
    "apikey": "${targetToken}",
    "Content-Type": "application/json"
}
payload = {
    "number": "${targetNumber}",
    "text": "${targetText}"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippets[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setCurrentUser(null);
      setMobileMenuOpen(false);
      window.location.href = '/';
    }
  };

  const accountName = currentUser?.name?.trim() || currentUser?.email.split('@')[0] || '';
  const accountInitial = accountName.charAt(0).toLocaleUpperCase('ar-EG');
  const accountPlan = currentUser?.subscription?.plan || 'التجربة المجانية';

  const handleRealSend = async () => {
    if (!currentUser) return;

    if (instances.length === 0) {
      setApiError('يرجى إنشاء رقم واتساب أولاً في لوحة التحكم.');
      return;
    }

    const connected = instances.find(inst => inst.status === 'CONNECTED');
    if (!connected) {
      setApiError('جميع أرقام الواتساب المضافة غير متصلة حالياً. يرجى ربط رقم بالـ QR أولاً.');
      return;
    }

    const targetId = selectedInstanceId || connected.id;
    const targetInstance = instances.find(inst => inst.id === targetId);
    if (!targetInstance || targetInstance.status !== 'CONNECTED') {
      setApiError('الرقم المحدد غير متصل بالواتساب حالياً.');
      return;
    }

    if (!recipientPhone.trim()) {
      setApiError('يرجى إدخال رقم هاتف المستلم بالصيغة الدولية.');
      return;
    }

    if (!inputText.trim()) {
      setApiError('يرجى إدخال نص الرسالة.');
      return;
    }

    setApiError('');
    setApiSuccess(false);
    setIsSending(true);

    try {
      const res = await fetch(`/api/instances/${targetInstance.id}/send-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: recipientPhone,
          text: inputText
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إرسال الرسالة عبر الـ API.');
      }

      // Add message to chat mock
      const timeNow = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [...prev, { sender: 'user', text: inputText, time: timeNow }]);
      setInputText('');
      setApiSuccess(true);

      // Simulate Bot Response to acknowledge real delivery
      setTimeout(() => {
        setMessages(prev => [...prev, {
          sender: 'bot',
          text: `✓ تم إرسال رسالتك الفعلية بنجاح من رقمك (${targetInstance.name}) إلى الرقم المستلم ${recipientPhone}! 🚀`,
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        }]);
        setIsSending(false);
      }, 1500);

    } catch (err: any) {
      setApiError(err.message || 'حدث خطأ غير متوقع أثناء الإرسال.');
      setIsSending(false);
    }
  };

  const simulateSend = () => {
    if (!inputText.trim() || isSending) return;
    setIsSending(true);

    // Add user message to mock WhatsApp
    const timeNow = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { sender: 'user', text: inputText, time: timeNow }]);
    setInputText('');

    setTimeout(() => {
      // Simulate Bot Response
      setMessages(prev => [...prev, { 
        sender: 'bot', 
        text: '✓ تم استلام رسالتك عبر الـ API بنجاح! تم تحديث حالة شحنتك وهي الآن في الطريق للتسليم 🚚', 
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) 
      }]);
      setIsSending(false);
    }, 1200);
  };

  const faqs = [
    {
      q: 'هل يمكنني تجنب حظر أرقام الواتساب عند الإرسال؟',
      a: 'نعم بالتأكيد! توفر المنصة ميزة محاكاة السلوك البشري من خلال إظهار حالة "يكتب الآن..." أو "تسجيل مقطع صوتي..." مع فترات تأخير عشوائية متغيرة بين كل رسالة وأخرى لضمان سلامة الرقم.'
    },
    {
      q: 'هل يدعم النظام ربط أكثر من رقم واتساب للجلسة الواحدة؟',
      a: 'تعتمد خطط الأسعار على عدد الحسابات (Instances). تتيح لك الباقة الاحترافية ربط 3 أرقام منفصلة، وباقة الوكالات تتيح لك حتى 10 أرقام أو أكثر للتحكم بها من نفس الحساب.'
    },
    {
      q: 'هل يمكنني دمج الذكاء الاصطناعي GPT مع البوت الخاص بي؟',
      a: 'نعم، نوفر دمجاً مباشراً مع خوادم OpenAI. يمكنك تزويد البوت بمفتاح الـ API الخاص بك وتحديد القوانين والردود الخاصة بشركتك ليتولى الرد التلقائي الذكي على العملاء.'
    },
    {
      q: 'هل تقدمون إضافة لربط إرسال الرسائل مع جداول Google Sheets؟',
      a: 'بالتأكيد! يتوفر تكامل Google Sheets لعملاء باقات Pro وEnterprise، ويتيح إطلاق حملات مخصصة مباشرة من بيانات العملاء بسهولة وتحكم كامل.'
    }
  ];

  return (
    <div className="relative min-h-screen w-full max-w-[100vw] overflow-x-hidden">
      <div className="bg-grid"></div>

      {/* --- Header / Navbar --- */}
      <header className="relative z-50 border-b border-[rgba(255,255,255,0.06)] bg-[#060b11]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-[75px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ConvoBest" className="w-10 h-10 rounded-xl shadow-lg shadow-[#00ffa7]/15 object-cover" />
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-[#00ffa7] bg-clip-text text-transparent">ConvoBest</span>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden xl:flex items-center gap-6 text-sm font-semibold text-[#90a4ae]">
            <a href="#features" className="hover:text-[#00ffa7]">المميزات</a>
            <a href="#demo" className="hover:text-[#00ffa7]">تجربة تفاعلية</a>
            <a href="#pricing" className="hover:text-[#00ffa7]">الأسعار</a>
            <a href="#faq" className="hover:text-[#00ffa7]">الأسئلة الشائعة</a>
          </nav>

          <div className="hidden md:flex items-center gap-3 min-h-12">
            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0c1420]/80 hover:bg-[#0e1724] hover:border-[#00ffa7]/30 hover:shadow-[0_0_20px_rgba(0,255,167,0.08)] px-4 py-2 transition-all duration-300 text-right cursor-pointer select-none group"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-[#00ffa7]/15 to-[#00b0ff]/15 text-sm font-black text-[#00ffa7] border border-[#00ffa7]/20 transition-all duration-300 group-hover:scale-105 group-hover:border-[#00ffa7]/40 group-hover:shadow-[0_0_12px_rgba(0,255,167,0.15)]">
                    {accountInitial}
                  </div>
                  <div className="hidden sm:block text-right leading-tight max-w-[140px]">
                    <div className="truncate text-xs font-bold text-white group-hover:text-[#00ffa7] transition-colors">{accountName}</div>
                    <div className="mt-0.5 truncate text-[10px] text-[#607d8b] group-hover:text-[#90a4ae] transition-colors">{currentUser.email}</div>
                  </div>
                  <span className="hidden md:inline-block whitespace-nowrap rounded-lg border border-[#00b0ff]/20 bg-[#00b0ff]/10 px-2.5 py-1 text-[9px] font-black text-[#58c8ff] transition-all group-hover:border-[#00b0ff]/40 group-hover:bg-[#00b0ff]/15">
                    {accountPlan}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-[#607d8b] group-hover:text-white transition-transform duration-300 ${dropdownOpen ? 'rotate-180 text-[#00ffa7]' : ''}`} />
                </button>

                {/* Backdrop to close on click outside */}
                {dropdownOpen && (
                  <div className="fixed inset-0 z-30 cursor-default" onClick={() => setDropdownOpen(false)}></div>
                )}

                {/* Dropdown Menu */}
                <div className={`absolute left-0 mt-3 w-64 rounded-2xl border border-white/[0.08] bg-[#0c1420]/95 backdrop-blur-xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.55)] z-40 transition-all duration-300 origin-top-left ${
                  dropdownOpen 
                    ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto visible' 
                    : 'opacity-0 scale-95 -translate-y-2 pointer-events-none invisible'
                }`}>
                  {/* Profile summary in dropdown header */}
                  <div className="px-3 py-3 mb-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-[#00ffa7]/20 to-[#00b0ff]/20 text-xs font-black text-[#00ffa7] border border-[#00ffa7]/15">
                        {accountInitial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold text-white">{accountName}</div>
                        <div className="truncate text-[10px] text-[#607d8b]">{currentUser.email}</div>
                      </div>
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-white/[0.04] flex items-center justify-between">
                      <span className="text-[10px] text-[#607d8b] font-semibold">نوع الحساب:</span>
                      <span className="rounded-md border border-[#00b0ff]/25 bg-[#00b0ff]/8 px-2 py-0.5 text-[9px] font-black text-[#58c8ff]">
                        {accountPlan}
                      </span>
                    </div>
                  </div>

                  {/* Menu Actions */}
                  <div className="flex flex-col gap-1">
                    <a 
                      href="/dashboard" 
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-[#90a4ae] hover:bg-[#00ffa7]/10 hover:text-[#00ffa7] border border-transparent hover:border-[#00ffa7]/10 transition-all duration-200 group/item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <div className="flex items-center gap-2.5">
                        <LayoutDashboard className="w-4 h-4 text-[#90a4ae] group-hover/item:text-[#00ffa7] group-hover/item:rotate-3 transition-all duration-200" />
                        <span>لوحة التحكم الرئيسية</span>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 opacity-0 group-hover/item:opacity-100 transition-all duration-250 -rotate-90 text-[#00ffa7] translate-x-1" />
                    </a>

                    <a 
                      href="/dashboard/api-docs" 
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold text-[#90a4ae] hover:bg-[#00b0ff]/10 hover:text-[#00b0ff] border border-transparent hover:border-[#00b0ff]/10 transition-all duration-200 group/item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <div className="flex items-center gap-2.5">
                        <Terminal className="w-4 h-4 text-[#90a4ae] group-hover/item:text-[#00b0ff] transition-colors duration-200" />
                        <span>توثيق الـ API المطورين</span>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 opacity-0 group-hover/item:opacity-100 transition-all duration-250 -rotate-90 text-[#00b0ff] translate-x-1" />
                    </a>

                    <hr className="border-white/[0.04] my-1" />

                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        handleLogout();
                      }}
                      className="flex items-center justify-between w-full text-right px-3 py-2.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 border border-transparent hover:border-red-500/10 transition-all duration-200 bg-transparent cursor-pointer group/item"
                    >
                      <div className="flex items-center gap-2.5">
                        <LogOut className="w-4 h-4 text-red-400 group-hover/item:text-red-300 transition-colors duration-200" />
                        <span>تسجيل الخروج</span>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 opacity-0 group-hover/item:opacity-100 transition-all duration-250 -rotate-90 text-red-300 translate-x-1" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <a href="/login" className="btn-secondary py-2.5 px-6 text-sm">تسجيل الدخول</a>
                <a href="/register" className="btn-primary py-2.5 px-6 text-sm">ابدأ مجاناً</a>
              </>
            )}
          </div>

          {/* Mobile Menu Btn */}
          <button
            type="button"
            className="md:hidden text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-[75px] left-0 right-0 bg-[#0e1622] border-b border-[rgba(255,255,255,0.1)] p-6 flex flex-col gap-5 z-20">
            <a href="#features" className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>المميزات</a>
            <a href="#demo" className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>تجربة تفاعلية</a>
            <a href="#pricing" className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>الأسعار</a>
            <a href="#faq" className="text-lg font-medium" onClick={() => setMobileMenuOpen(false)}>الأسئلة الشائعة</a>
            <hr className="border-[rgba(255,255,255,0.06)]" />
            {currentUser ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.025] p-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-[#00ffa7]/12 text-base font-black text-[#00ffa7] ring-1 ring-[#00ffa7]/25">
                    {accountInitial}
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <div className="truncate text-sm font-bold text-white">{accountName}</div>
                    <div className="truncate text-xs text-[#607d8b]">{currentUser.email}</div>
                  </div>
                  <span className="rounded-md border border-[#00b0ff]/20 bg-[#00b0ff]/10 px-2 py-1 text-[10px] font-bold text-[#58c8ff]">
                    {accountPlan}
                  </span>
                </div>
                <div className="flex gap-3">
                  <a href="/dashboard" className="btn-primary flex-1 py-3 text-sm">
                    <LayoutDashboard className="h-4 w-4" />
                    لوحة التحكم
                  </a>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border border-red-400/20 bg-red-400/[0.06] text-red-300"
                    aria-label="تسجيل الخروج"
                    title="تسجيل الخروج"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <a href="/login" className="btn-secondary text-center w-full py-3">تسجيل الدخول</a>
                <a href="/register" className="btn-primary text-center w-full py-3">ابدأ مجاناً</a>
              </div>
            )}
          </div>
        )}
      </header>

      {/* --- Hero Section --- */}
      <section className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-16 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <div className="lg:col-span-7 flex flex-col gap-6 animate-fade-in text-right">
          <div className="inline-flex self-start items-center gap-2 bg-[#00ffa7]/10 border border-[#00ffa7]/20 rounded-full px-4 py-1.5 text-[#00ffa7] text-xs font-bold tracking-wide">
            <span className="indicator-online"></span>
            محرك Go فائق الأداء والسرعة
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-[1.25] text-white">
            بوابة الـ <span className="bg-gradient-to-r from-[#00ffa7] to-[#00b0ff] bg-clip-text text-transparent text-glow-primary">WhatsApp API</span> <br />
            الأسرع لمشروعك ومتجرك
          </h1>
          <p className="text-lg text-[#90a4ae] max-w-xl leading-[1.7]">
            أرسل الإشعارات التلقائية، أدر حملاتك الإعلانية، وابنِ شات بوت ذكي بالذكاء الاصطناعي لخدمة عملائك على مدار الساعة بأداء فائق واستقرار غير مسبوق.
          </p>
          <div className="flex flex-wrap gap-4 mt-4">
            {currentUser ? (
              <a href="/dashboard" className="btn-primary py-3.5 px-8">
                الانتقال إلى لوحة التحكم
                <LayoutDashboard className="w-4 h-4 ml-1" />
              </a>
            ) : (
              <a href="#demo" className="btn-primary py-3.5 px-8">
                جرب المحاكي التفاعلي
                <Play className="w-4 h-4 ml-1" />
              </a>
            )}
            {currentUser ? (
              <a href="#demo" className="btn-secondary py-3.5 px-8">
                إختبار الإرسال
              </a>
            ) : (
              <a href="#pricing" className="btn-secondary py-3.5 px-8">
                عرض الباقات والأسعار
              </a>
            )}
          </div>
          <div className="grid grid-cols-3 gap-8 border-t border-[rgba(255,255,255,0.06)] pt-8 mt-4 text-center lg:text-right">
            <div>
              <div className="text-2xl font-bold text-[#00ffa7] text-glow-primary">+150ms</div>
              <div className="text-xs text-[#607d8b] mt-1 font-semibold">سرعة استجابة الـ API</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-[#00b0ff] text-glow-secondary">%99.9</div>
              <div className="text-xs text-[#607d8b] mt-1 font-semibold">معدل تشغيل الخدمة Uptime</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">صفر</div>
              <div className="text-xs text-[#607d8b] mt-1 font-semibold">تعقيد أو إعدادات صعبة</div>
            </div>
          </div>
        </div>

        {/* Hero Interactive Phone Mockup */}
        <div className="lg:col-span-5 flex justify-center animate-fade-in-delay-1">
          <div className="phone-mockup relative bg-[#060b11] border-[8px] border-[#162232] rounded-[40px] shadow-2xl overflow-hidden flex flex-col" style={{minHeight: '580px'}}>
            {/* Camera notch */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-[#162232] rounded-b-2xl z-20 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-black"></div>
            </div>
            
            {/* Phone Header */}
            <div className="bg-[#0b141a] pt-8 pb-3 px-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.04)] z-10">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="ConvoBest Bot" className="w-8 h-8 rounded-full border border-[#00ffa7]/30 object-cover" />
                <div>
                  <h4 className="text-sm font-bold text-white">ConvoBest Bot</h4>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ffa7] animate-pulse"></span>
                    <span className="text-[10px] text-[#00ffa7]">متصل الآن</span>
                  </div>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-[#607d8b]"></div>
            </div>

            {/* Chat Body */}
            <div 
              id="mock-chat-body" 
              className="flex-1 p-4 overflow-y-auto flex flex-col gap-3 scroll-smooth"
              style={{
                backgroundImage: 'radial-gradient(rgba(0, 255, 167, 0.02) 1px, transparent 1px)',
                backgroundSize: '16px 16px',
                backgroundColor: '#070d14'
              }}
            >
              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`max-w-[80%] p-3 rounded-2xl text-xs flex flex-col gap-1.5 animate-fade-in ${
                    msg.sender === 'user' 
                      ? 'bg-[#00ffa7]/15 border border-[#00ffa7]/20 text-white self-end rounded-br-none' 
                      : 'bg-[#121e2a] border border-[rgba(255,255,255,0.04)] text-[#90a4ae] self-start rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <span className="text-[8px] text-[#607d8b] self-end">{msg.time}</span>
                </div>
              ))}
              {isSending && (
                <div className="bg-[#121e2a] p-3 rounded-2xl text-xs self-start rounded-bl-none text-[#607d8b] animate-pulse">
                  يكتب الآن...
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div className="p-3 bg-[#0b141a] flex gap-2 border-t border-[rgba(255,255,255,0.04)]">
              <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="اكتب رسالة تجريبية..."
                className="flex-1 bg-[#121e2a] border border-[rgba(255,255,255,0.04)] text-xs text-white rounded-full px-4 py-2.5 focus:outline-none focus:border-[#00ffa7]"
                onKeyDown={(e) => e.key === 'Enter' && simulateSend()}
              />
              <button 
                onClick={simulateSend}
                disabled={isSending}
                className="w-9 h-9 rounded-full bg-[#00ffa7] flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-[#060b11]"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* --- Features Section --- */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-24 border-t border-[rgba(255,255,255,0.04)]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">كل ما تحتاجه لإدارة اتصالاتك باحترافية</h2>
          <p className="text-[#90a4ae]">ميزات حصرية ومطورة لمساعدتك على أتمتة الرسائل وخدمة العملاء بأقل مجهود وبدون قيود.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="glass-card flex flex-col gap-4 text-right">
            <div className="w-12 h-12 rounded-xl bg-[#00ffa7]/10 flex items-center justify-center self-end border border-[#00ffa7]/20">
              <Zap className="w-6 h-6 text-[#00ffa7]" />
            </div>
            <h3 className="text-xl font-bold">أداء فائق بلغة Go</h3>
            <p className="text-sm text-[#90a4ae]">
              على عكس الأنظمة التقليدية، يعتمد ConvoBest على محرك Go مخصص يستهلك موارد خفيفة للغاية، مما يضمن وصول رسائل العميل بأجزاء من الثانية.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-card flex flex-col gap-4 text-right">
            <div className="w-12 h-12 rounded-xl bg-[#00b0ff]/10 flex items-center justify-center self-end border border-[#00b0ff]/20">
              <Bot className="w-6 h-6 text-[#00b0ff]" />
            </div>
            <h3 className="text-xl font-bold">شات بوت ذكي بالـ AI</h3>
            <p className="text-sm text-[#90a4ae]">
              اربط أرقامك مباشرة مع ChatGPT. قم بتغذية الذكاء الاصطناعي بتفاصيل عملك واتركه يجيب على أسئلة عملائك ويقفل المبيعات تلقائياً.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-card flex flex-col gap-4 text-right">
            <div className="w-12 h-12 rounded-xl bg-[#ff9100]/10 flex items-center justify-center self-end border border-[#ff9100]/20">
              <Send className="w-6 h-6 text-[#ff9100]" />
            </div>
            <h3 className="text-xl font-bold">حملات الإرسال الجماعي</h3>
            <p className="text-sm text-[#90a4ae]">
              ارسل آلاف الرسائل دفعة واحدة عبر رفع ملف Excel. يمكنك تخصيص النصوص وتحديد فواصل زمنية عشوائية ذكية للوقاية الكاملة من الحظر.
            </p>
          </div>

          {/* Card 4 */}
          <div className="glass-card flex flex-col gap-4 text-right">
            <div className="w-12 h-12 rounded-xl bg-[#00ffa7]/10 flex items-center justify-center self-end border border-[#00ffa7]/20">
              <Users className="w-6 h-6 text-[#00ffa7]" />
            </div>
            <h3 className="text-xl font-bold">صندوق الوارد الموحد (WhatsApp Web)</h3>
            <p className="text-sm text-[#90a4ae]">
              واجهة محادثات متكاملة تتيح لفريقك إرسال واستقبال وإدارة كافة الرسائل، ورؤية تفاصيل جهات الاتصال كأنك تستخدم واتساب ويب تماماً من داخل لوحة التحكم.
            </p>
          </div>

          {/* Card 5 */}
          <div className="glass-card flex flex-col gap-4 text-right">
            <div className="w-12 h-12 rounded-xl bg-[#00b0ff]/10 flex items-center justify-center self-end border border-[#00b0ff]/20">
              <ShieldCheck className="w-6 h-6 text-[#00b0ff]" />
            </div>
            <h3 className="text-xl font-bold">سلوك بشري ذكي (Anti-Ban)</h3>
            <p className="text-sm text-[#90a4ae]">
              يحاكي النظام حركة الطباعة البشرية الفعلية قبل إرسال الرسالة، مما يجعل خوادم واتساب تتعامل مع رقمك كشخص طبيعي.
            </p>
          </div>

          {/* Card 6 */}
          <div className="glass-card flex flex-col gap-4 text-right">
            <div className="w-12 h-12 rounded-xl bg-[#ff9100]/10 flex items-center justify-center self-end border border-[#ff9100]/20">
              <Code className="w-6 h-6 text-[#ff9100]" />
            </div>
            <h3 className="text-xl font-bold">واجهة برمجية وويب هوك كامل</h3>
            <p className="text-sm text-[#90a4ae]">
              ربط فوري للمبرمجين مع توثيق كود تفاعلي متكامل واستقبال تحديثات الرسائل فوراً على نظامك عبر الويب هوك السريع.
            </p>
          </div>

          {/* Card 7 */}
          <div className="glass-card flex flex-col gap-4 text-right">
            <div className="w-12 h-12 rounded-xl bg-[#00ffa7]/10 flex items-center justify-center self-end border border-[#00ffa7]/20">
              <ShoppingBag className="w-6 h-6 text-[#00ffa7]" />
            </div>
            <h3 className="text-xl font-bold">تكامل كامل مع ووكومرس</h3>
            <p className="text-sm text-[#90a4ae]">
              اربط متجرك الإلكتروني بووكومرس لإرسال إشعارات تغيير حالة الطلبات، وتأكيد الدفع التلقائي، وتنبيهات الشحن، واستعادة السلال المتروكة تلقائياً.
            </p>
          </div>

          {/* Card 8 */}
          <div className="glass-card flex flex-col gap-4 text-right">
            <div className="w-12 h-12 rounded-xl bg-[#00b0ff]/10 flex items-center justify-center self-end border border-[#00b0ff]/20">
              <ExternalLink className="w-6 h-6 text-[#00b0ff]" />
            </div>
            <h3 className="text-xl font-bold">الربط مع Google Sheets</h3>
            <p className="text-sm text-[#90a4ae]">
              أرسل حملاتك التسويقية الجماعية ورسائل التذكير مباشرة من جداول بيانات Google Sheets الخاصة بك بنقرة زر واحدة دون أي مجهود برمجي.
            </p>
          </div>

          {/* Card 9 */}
          <div className="glass-card flex flex-col gap-4 text-right">
            <div className="w-12 h-12 rounded-xl bg-[#ff9100]/10 flex items-center justify-center self-end border border-[#ff9100]/20">
              <Database className="w-6 h-6 text-[#ff9100]" />
            </div>
            <h3 className="text-xl font-bold">Data Feed ذكي للمنتجات</h3>
            <p className="text-sm text-[#90a4ae]">
              اربط ملف منتجاتك ليصبح الـ AI على علم دائم بالمخزون، الأسعار، الصور، والتوافر، فيرشح المنتج المناسب للعميل ويرد بإجابات دقيقة تساعد على إتمام البيع.
            </p>
          </div>
        </div>
      </section>

      {/* --- Detailed Feature Showcase Section --- */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 border-t border-[rgba(255,255,255,0.04)] flex flex-col gap-32">
        
        {/* Showcase 1: Unified Inbox */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Visual Side (Left) */}
          <div className="lg:col-span-6 flex justify-center order-2 lg:order-1">
            <div className="w-full max-w-md bg-[#0e1622]/85 border border-[rgba(255,255,255,0.06)] rounded-2xl p-5 shadow-2xl relative overflow-hidden backdrop-blur-md">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.04)] pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#121e2a] flex items-center justify-center border border-[#00ffa7]/30">
                    <Users className="w-4.5 h-4.5 text-[#00ffa7]" />
                  </div>
                  <div className="text-right">
                    <h4 className="text-xs font-bold text-white">صندوق الدعم الموحد</h4>
                    <span className="text-[9px] text-[#00ffa7] bg-[#00ffa7]/10 px-2 py-0.5 rounded-full font-black mt-1 inline-block">نشط ومتصل</span>
                  </div>
                </div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#00ffa7] animate-pulse"></div>
              </div>

              {/* Chat Stream mockup */}
              <div className="flex flex-col gap-3.5 min-h-[200px] justify-end pb-2">
                {/* Message 1 Received */}
                <div className="max-w-[85%] bg-[#121e2a] border border-[rgba(255,255,255,0.03)] p-3 rounded-2xl rounded-bl-none text-[11px] text-[#90a4ae] self-start text-right">
                  <span className="text-[9px] text-[#00b0ff] font-bold block mb-1">العميل: أحمد محمد</span>
                  <p className="leading-relaxed">مرحباً، هل تم شحن الطلب الخاص بي رقم #8762؟</p>
                  <span className="text-[8px] text-[#607d8b] mt-1 block text-left">10:42 ص</span>
                </div>

                {/* Message 2 Sent */}
                <div className="max-w-[85%] bg-[#00ffa7]/15 border border-[#00ffa7]/20 p-3 rounded-2xl rounded-br-none text-[11px] text-white self-end text-right">
                  <span className="text-[9px] text-[#00ffa7] font-bold block mb-1">الرد التلقائي أو الموظف (سارة)</span>
                  <p className="leading-relaxed">أهلاً أحمد! نعم، تم تسليم طلبك لشركة الشحن وسيقوم المندوب بالتواصل معك غداً للتسليم 🚚</p>
                  <span className="text-[8px] text-[#607d8b] mt-1 block text-left">10:43 ص ✓✓</span>
                </div>
              </div>

              {/* Simulated input bar */}
              <div className="border-t border-[rgba(255,255,255,0.04)] pt-3.5 mt-2 flex items-center gap-2">
                <div className="flex-1 bg-[#060b11] border border-[rgba(255,255,255,0.04)] rounded-full px-3 py-1.5 text-[10px] text-[#607d8b] text-right">اكتب رداً للموظف...</div>
                <div className="w-8 h-8 rounded-full bg-[#00ffa7]/10 border border-[#00ffa7]/20 flex items-center justify-center text-[#00ffa7]">
                  <Send className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>

          {/* Text Side (Right) */}
          <div className="lg:col-span-6 flex flex-col gap-6 text-right order-1 lg:order-2">
            <div className="inline-flex self-start items-center gap-1.5 bg-[#00ffa7]/10 border border-[#00ffa7]/20 rounded-full px-3 py-1 text-[#00ffa7] text-[10px] font-bold">
              <Users className="w-3.5 h-3.5" />
              <span>فريق دعم متكامل</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              صندوق الوارد الموحد <br />
              <span className="bg-gradient-to-r from-[#00ffa7] to-[#00b0ff] bg-clip-text text-transparent">كأنك تستخدم واتساب ويب تماماً</span>
            </h2>
            <p className="text-sm text-[#90a4ae] leading-relaxed">
              لا تشتت فريقك وعملائك بين عدة هواتف أو حسابات متفرقة. تمنحك منصتنا شاشة واحدة تجمع كافة الدردشات الواردة لجميع الموظفين مع إمكانية الرد الفوري، إرسال الوسائط، والمتابعة الذكية بأداء فائق الاستقرار.
            </p>

            <div className="flex flex-col gap-4 mt-2">
              {/* Item 1 */}
              <div className="flex items-start gap-3" style={{ direction: 'rtl' }}>
                <div className="w-5 h-5 rounded-full bg-[#00ffa7]/15 flex items-center justify-center text-[#00ffa7] flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="text-right">
                  <strong className="text-white block text-sm mb-0.5">إرسال واستقبال لحظي للرسائل</strong>
                  <span className="text-xs font-semibold text-[#90a4ae] leading-relaxed block">
                    استمتع بمزامنة كاملة للرسائل النصية والملفات والصور والتسجيلات الصوتية مباشرة من لوحة التحكم.
                  </span>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex items-start gap-3" style={{ direction: 'rtl' }}>
                <div className="w-5 h-5 rounded-full bg-[#00ffa7]/15 flex items-center justify-center text-[#00ffa7] flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="text-right">
                  <strong className="text-white block text-sm mb-0.5">إسناد وتوزيع المحادثات للموظفين</strong>
                  <span className="text-xs font-semibold text-[#90a4ae] leading-relaxed block">
                    قم بتوجيه كل عميل إلى موظف المبيعات أو الدعم المختص تلقائياً لمنع تكرار الردود وتنظيم الخدمة.
                  </span>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex items-start gap-3" style={{ direction: 'rtl' }}>
                <div className="w-5 h-5 rounded-full bg-[#00ffa7]/15 flex items-center justify-center text-[#00ffa7] flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="text-right">
                  <strong className="text-white block text-sm mb-0.5">متابعة الأداء وسرعة الاستجابة</strong>
                  <span className="text-xs font-semibold text-[#90a4ae] leading-relaxed block">
                    راقب سرعة استجابة موظفيك لخدمة العملاء وعدد المحادثات المغلقة بنجاح لضمان أقصى كفاءة تشغيلية.
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Showcase 2: WooCommerce Integration */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Text Side (Left) */}
          <div className="lg:col-span-6 flex flex-col gap-6 text-right">
            <div className="inline-flex self-start items-center gap-1.5 bg-[#00b0ff]/10 border border-[#00b0ff]/20 rounded-full px-3 py-1 text-[#00b0ff] text-[10px] font-bold">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>متاجر التجارة الإلكترونية</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              تكامل ووكومرس الكامل <br />
              <span className="bg-gradient-to-r from-[#00b0ff] to-[#00ffa7] bg-clip-text text-transparent">أتمتة المبيعات وتأكيد الطلبات تلقائياً</span>
            </h2>
            <p className="text-sm text-[#90a4ae] leading-relaxed">
              اربط متجر الوردبريس والووكومرس الخاص بك بضغطة زر واحدة. تمنحك منصتنا تحكماً ذكياً يربط إجراءات متجرك برسائل واتساب تفاعلية وسريعة لزيادة أرباحك وتوثيق عمليات الشراء.
            </p>

            <div className="flex flex-col gap-4 mt-2">
              {/* Item 1 */}
              <div className="flex items-start gap-3" style={{ direction: 'rtl' }}>
                <div className="w-5 h-5 rounded-full bg-[#00b0ff]/15 flex items-center justify-center text-[#00b0ff] flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="text-right">
                  <strong className="text-white block text-sm mb-0.5">إشعارات الطلبات والشحن التلقائية</strong>
                  <span className="text-xs font-semibold text-[#90a4ae] leading-relaxed block">
                    أرسل رسالة فورية ومخصصة باسم العميل بمجرد إتمام الشراء، ومتابعة حالة طلبه تلقائياً عند التوصيل.
                  </span>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex items-start gap-3" style={{ direction: 'rtl' }}>
                <div className="w-5 h-5 rounded-full bg-[#00b0ff]/15 flex items-center justify-center text-[#00b0ff] flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="text-right">
                  <strong className="text-white block text-sm mb-0.5">استعادة السلال المتروكة (Abandoned Cart)</strong>
                  <span className="text-xs font-semibold text-[#90a4ae] leading-relaxed block">
                    استهدف العملاء الذين لم يكملوا الدفع برسائل تذكير لطيفة تحتوي على المنتجات المتروكة ورابط الدفع المباشر.
                  </span>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex items-start gap-3" style={{ direction: 'rtl' }}>
                <div className="w-5 h-5 rounded-full bg-[#00b0ff]/15 flex items-center justify-center text-[#00b0ff] flex-shrink-0 mt-0.5">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="text-right">
                  <strong className="text-white block text-sm mb-0.5">أمان وحماية بالتحقق OTP بالواتساب</strong>
                  <span className="text-xs font-semibold text-[#90a4ae] leading-relaxed block">
                    تجنب الطلبات الوهمية وتأكد من جدية العملاء بإرسال كود تحقق سريع للهاتف قبل إتمام الدفع بالمتجر.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Side (Right) */}
          <div className="lg:col-span-6 flex justify-center">
            <div className="w-full max-w-md bg-[#0e1622]/85 border border-[rgba(255,255,255,0.06)] rounded-2xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
              {/* Event Workflow Mockup */}
              <div className="flex flex-col gap-4 text-right">
                <h4 className="text-xs font-bold text-white mb-2">مسار أتمتة متجر WooCommerce</h4>
                
                {/* Event 1 */}
                <div className="flex items-center justify-between bg-[#060b11]/80 border border-[rgba(255,255,255,0.04)] rounded-xl p-3.5">
                  <div className="bg-[#00ffa7]/10 border border-[#00ffa7]/20 text-[#00ffa7] text-[9px] font-black px-2 py-0.5 rounded-md">إرسال واتساب ✓</div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-white block">عند إنشاء طلب جديد (Pending Order)</span>
                    <span className="text-[8px] text-[#607d8b]">إرسال رسالة: "مرحباً {`{الاسم}`}، تم استلام طلبك..."</span>
                  </div>
                </div>

                {/* Arrow Connector */}
                <div className="w-0.5 h-3 bg-[rgba(255,255,255,0.06)] mr-8"></div>

                {/* Event 2 */}
                <div className="flex items-center justify-between bg-[#060b11]/80 border border-[rgba(255,255,255,0.04)] rounded-xl p-3.5">
                  <div className="bg-[#ff9100]/10 border border-[#ff9100]/20 text-[#ff9100] text-[9px] font-black px-2 py-0.5 rounded-md">انتظار ساعة ⏳</div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-white block">عند بقاء السلة متروكة (Cart Abandoned)</span>
                    <span className="text-[8px] text-[#607d8b]">جدولة متابعة تلقائية مع كود خصم خاص بالعميل</span>
                  </div>
                </div>

                {/* Arrow Connector */}
                <div className="w-0.5 h-3 bg-[rgba(255,255,255,0.06)] mr-8"></div>

                {/* Event 3 */}
                <div className="flex items-center justify-between bg-[#060b11]/80 border border-[rgba(255,255,255,0.04)] rounded-xl p-3.5">
                  <div className="bg-[#00b0ff]/10 border border-[#00b0ff]/20 text-[#00b0ff] text-[9px] font-black px-2 py-0.5 rounded-md">إرسال واتساب ✓</div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-white block">عند شحن الطلب (Order Shipped)</span>
                    <span className="text-[8px] text-[#607d8b]">إرسال: "طلبك رقم {`{الرقم}`} في الطريق إليك..."</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </section>

      {/* --- Live Interactive API Demo Console --- */}
      <section id="demo" className="relative z-10 w-full max-w-none px-6 md:px-12 lg:px-16 xl:px-24 py-24 border-t border-[rgba(255,255,255,0.04)] bg-[#070d14]/20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div className="lg:col-span-6 flex flex-col gap-6 text-right">
            <h2 className="text-3xl md:text-4xl font-extrabold">منصة صديقة للمطورين وأصحاب المواقع</h2>
            <p className="text-[#90a4ae]">
              بسطنا عملية الربط البرمجي لأقصى حد. اختر لغة البرمجة المفضلة لديك، انسخ الكود، وابدأ في الإرسال الفوري لرسائلك في أقل من دقيقة.
            </p>
            <div className="flex flex-col gap-4 mt-2">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-[#00ffa7]" />
                <span className="text-sm font-semibold">إمكانية فحص الأرقام قبل الاشتراك في المنصة (Check WhatsApp)</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-[#00ffa7]" />
                <span className="text-sm font-semibold">إرسال النصوص، الروابط، الصور، والملفات والملصقات</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-[#00ffa7]" />
                <span className="text-sm font-semibold">تحديثات فورية لحالة استلام وقراءة الرسائل</span>
              </div>
              <div className="flex items-start gap-3 mt-1">
                <AlertTriangle className="w-5 h-5 text-[#ff9100] shrink-0 mt-0.5" />
                <span className="text-sm font-semibold text-[#ff9100]/95">
                  تنبيه: يجب إدخال رقم هاتف المستلم بالصيغة الدولية متضمناً كود مفتاح الدولة (مثال: 2010...) لتجربة الإرسال بنجاح.
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Code Console */}
          <div className="lg:col-span-6">
            <div className="bg-[#0e1622] border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
              {/* Console Header / Tabs */}
              <div className="bg-[#060b11] px-4 py-3 flex items-center justify-between border-b border-[rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                </div>
                
                {/* Tabs */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => setActiveTab('curl')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'curl' 
                        ? 'bg-[#00ffa7]/10 text-[#00ffa7] border border-[#00ffa7]/20' 
                        : 'text-[#607d8b] hover:text-white'
                    }`}
                  >
                    cURL
                  </button>
                  <button 
                    onClick={() => setActiveTab('node')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'node' 
                        ? 'bg-[#00b0ff]/10 text-[#00b0ff] border border-[#00b0ff]/20' 
                        : 'text-[#607d8b] hover:text-white'
                    }`}
                  >
                    Node.js
                  </button>
                  <button 
                    onClick={() => setActiveTab('python')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      activeTab === 'python' 
                        ? 'bg-[#ff9100]/10 text-[#ff9100] border border-[#ff9100]/20' 
                        : 'text-[#607d8b] hover:text-white'
                    }`}
                  >
                    Python
                  </button>
                </div>
              </div>

              {/* Console Code Area */}
              <div className="p-6 relative font-mono text-xs text-[#90a4ae] overflow-x-auto min-h-[200px] bg-[#070d14]">
                <pre className="text-left whitespace-pre-wrap break-all sm:whitespace-pre sm:break-normal" style={{ direction: 'ltr' }}>{codeSnippets[activeTab]}</pre>
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={handleCopy}
                    className="p-2 rounded-lg bg-[#0e1622] hover:bg-[#162232] border border-[rgba(255,255,255,0.06)] text-[#90a4ae] hover:text-white transition-all"
                    title="Copy code"
                  >
                    {copied ? <Check className="w-4 h-4 text-[#00ffa7]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Console Footer (Interactive Controller) */}
              <div className="p-4 bg-[#060b11] border-t border-[rgba(255,255,255,0.04)] flex flex-col sm:flex-row gap-4 items-center justify-between relative overflow-hidden min-h-[90px]">
                {!currentUser ? (
                  <div className="absolute inset-0 bg-[#060b11]/90 backdrop-blur-[3px] flex flex-col sm:flex-row items-center justify-between px-6 py-3.5 gap-4 z-20">
                    <div className="text-right flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#00ffa7]/10 border border-[#00ffa7]/20 flex items-center justify-center text-[#00ffa7] shrink-0">
                        <Bot className="w-4 h-4 animate-pulse" />
                      </div>
                      <div className="leading-tight flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white truncate sm:normal-case">التجربة الفعلية تتطلب تسجيل الدخول</h4>
                        <p className="text-[10px] text-[#607d8b] mt-0.5 leading-relaxed">سجل دخولك الآن لربط رقمك وإرسال رسائل حقيقية عبر الـ API.</p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
                      <a href="/login" className="btn-primary py-2 px-4 text-xs font-bold flex-1 sm:flex-none justify-center whitespace-nowrap">تسجيل الدخول</a>
                      <a href="/register" className="btn-secondary py-2 px-4 text-xs font-bold flex-1 sm:flex-none justify-center whitespace-nowrap">حساب مجاني</a>
                    </div>
                  </div>
                ) : instances.length === 0 ? (
                  <div className="absolute inset-0 bg-[#060b11]/95 backdrop-blur-[3px] flex flex-col sm:flex-row items-center justify-between px-6 py-3.5 gap-4 z-20">
                    <div className="text-right flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
                        <AlertTriangle className="w-4 h-4 animate-pulse" />
                      </div>
                      <div className="leading-tight flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white">لا يوجد رقم هاتف مضاف</h4>
                        <p className="text-[10px] text-[#607d8b] mt-0.5 leading-relaxed">يرجى إضافة رقم واتساب في لوحة التحكم وتوصيله أولاً.</p>
                      </div>
                    </div>
                    <a href="/dashboard/instances" className="btn-primary py-2 px-5 text-xs font-bold w-full sm:w-auto justify-center flex-shrink-0 whitespace-nowrap">
                      إضافة رقم واتساب الآن
                    </a>
                  </div>
                ) : connectedInstances.length === 0 ? (
                  <div className="absolute inset-0 bg-[#060b11]/95 backdrop-blur-[3px] flex flex-col sm:flex-row items-center justify-between px-6 py-3.5 gap-4 z-20">
                    <div className="text-right flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 shrink-0">
                        <AlertTriangle className="w-4 h-4 animate-pulse" />
                      </div>
                      <div className="leading-tight flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white">رقم الواتساب غير متصل</h4>
                        <p className="text-[10px] text-[#607d8b] mt-0.5 leading-relaxed">يرجى مسح رمز الـ QR وتوصيل رقمك من لوحة التحكم لتفعيل البث.</p>
                      </div>
                    </div>
                    <a href="/dashboard/instances" className="btn-primary py-2 px-5 text-xs font-bold w-full sm:w-auto justify-center flex-shrink-0 whitespace-nowrap">
                      مسح رمز الـ QR والربط
                    </a>
                  </div>
                ) : null}

                <div className="flex flex-col w-full gap-3 text-right">
                  {/* Instance selector & Error/Success Messages */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#607d8b] font-bold">الحساب المستخدم للإرسال:</span>
                      {connectedInstances.length > 1 ? (
                        <select
                          value={selectedInstanceId}
                          onChange={(e) => setSelectedInstanceId(e.target.value)}
                          className="bg-[#121e2a] border border-white/[0.08] text-[10px] text-[#00ffa7] rounded-lg px-2 py-1 focus:outline-none focus:border-[#00ffa7] font-bold cursor-pointer"
                        >
                          {connectedInstances.map((inst) => (
                            <option key={inst.id} value={inst.id} className="bg-[#0e1622] text-[#00ffa7]">
                              {inst.name} ({inst.id})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[10px] text-[#00ffa7] bg-[#00ffa7]/10 border border-[#00ffa7]/20 rounded-md px-2 py-0.5 font-bold">
                          {connectedInstances[0]?.name} ({connectedInstances[0]?.id})
                        </span>
                      )}
                    </div>
                    
                    {/* Error / Success feedback */}
                    {apiError && (
                      <span className="text-[10px] text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-3 py-0.5 rounded-md animate-pulse">
                        ⚠️ {apiError}
                      </span>
                    )}
                    {apiSuccess && (
                      <span className="text-[10px] text-[#00ffa7] font-bold bg-[#00ffa7]/10 border border-[#00ffa7]/20 px-3 py-0.5 rounded-md">
                        ✓ تم الإرسال الفعلي للرسالة بنجاح!
                      </span>
                    )}
                  </div>

                  {/* Form inputs & Button */}
                  <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
                    <div className="flex flex-col sm:flex-row gap-3 flex-1">
                      <div className="flex flex-col gap-1.5 flex-1">
                        <input 
                          type="text" 
                          value={recipientPhone}
                          onChange={(e) => setRecipientPhone(e.target.value)}
                          placeholder="رقم المستلم (مثال: 201012345678)"
                          className="bg-[#121e2a] border border-white/[0.08] text-xs text-white rounded-lg px-3.5 py-2 focus:outline-none focus:border-[#00ffa7] w-full placeholder-[#607d8b]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 flex-[1.5]">
                        <input 
                          type="text" 
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder="اكتب نص الرسالة..."
                          className="bg-[#121e2a] border border-white/[0.08] text-xs text-white rounded-lg px-3.5 py-2 focus:outline-none focus:border-[#00ffa7] w-full placeholder-[#607d8b]"
                        />
                      </div>
                    </div>
                    <button 
                      onClick={handleRealSend}
                      disabled={isSending}
                      className="btn-primary py-2 px-6 text-xs justify-center shrink-0"
                    >
                      {isSending ? 'جاري الإرسال الفعلي...' : 'تشغيل الـ API وإرسال الرسالة'}
                      <Play className="w-3 h-3 ml-1.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Pricing Section --- */}
      <section id="pricing" className="relative z-10 max-w-7xl mx-auto px-6 py-24 border-t border-[rgba(255,255,255,0.04)]">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">خطط أسعار مرنة واحترافية لمشروعك</h2>
          <p className="text-[#90a4ae] text-xs">اختر الخطة المناسبة لحجم أعمالك. تفعيل فوري وتلقائي عبر المحافظ الإلكترونية وإنستاباي.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Plan 1 */}
          <div className="glass-card flex flex-col justify-between text-right">
            <div>
              <h4 className="text-lg font-bold text-[#607d8b] mb-2">الباقة الأساسية (Starter)</h4>
              <div className="flex flex-col mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">4800</span>
                  <span className="text-xs text-[#607d8b]">جنيه مصري / سنوياً</span>
                </div>
                <span className="text-[10px] text-[#90a4ae] mt-1">ما يعادل 400 جنيه مصري شهرياً (تدفع سنوياً)</span>
              </div>
              <p className="text-xs text-[#90a4ae] mb-6 leading-relaxed">انطلاقة عملية للمتاجر الصغيرة التي تريد توحيد محادثات العملاء وأتمتة تحديثات الطلبات عبر واتساب.</p>
              <hr className="border-[rgba(255,255,255,0.04)] mb-6" />
              <ul className="flex flex-col gap-4 text-xs font-semibold text-[#90a4ae]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>ربط رقم واتساب واحد (1 Instance)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>حد إرسال شهري حتى 100,000 رسالة صادرة</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>شات بوت أساسي بالكلمات المفتاحية</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>ربط المطورين والويب هوك</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>حملات جماعية حتى 350 مستلم في الحملة الواحدة</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>تكامل WooCommerce لإرسال تحديثات الطلبات تلقائيا عبر واتساب</span>
                </li>
              </ul>
            </div>
            <a
              href={currentUser ? '/dashboard/billing' : '/register?plan=starter'}
              className={`${currentUser ? 'btn-secondary' : 'btn-primary starter-trial-cta'} w-full py-3.5 mt-8 text-center text-xs font-extrabold cursor-pointer`}
            >
              {currentUser ? (
                'إدارة الاشتراك'
              ) : (
                <>
                  <span>ابدأ الفترة التجريبية الآن</span>
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </a>
          </div>

          {/* Plan 2 - Recommended Pro */}
          <div className="glass-card flex flex-col justify-between text-right border-[#00ffa7]/30 shadow-2xl relative">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-[#00ffa7] to-[#00b0ff] text-[#060b11] text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-md">
              الموصى بها
            </div>
            <div>
              <h4 className="text-lg font-bold text-[#00ffa7] mb-2">الباقة الاحترافية (Pro)</h4>
              <div className="flex flex-col mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">9000</span>
                  <span className="text-xs text-[#607d8b]">جنيه مصري / سنوياً</span>
                </div>
                <span className="text-[10px] text-[#00ffa7]/70 mt-1">ما يعادل 750 جنيه مصري شهرياً (تدفع سنوياً)</span>
              </div>
              <p className="text-xs text-[#90a4ae] mb-6 leading-relaxed">للشركات النامية التي تحتاج إلى حملات أقوى، أتمتة متقدمة، واستفادة مباشرة من بيانات العملاء.</p>
              <hr className="border-[rgba(255,255,255,0.04)] mb-6" />
              <ul className="flex flex-col gap-4 text-xs font-semibold text-white">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>3 أرقام واتساب منفصلة (3 Instances)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>حد إرسال شهري حتى 200,000 رسالة صادرة</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>حملات جماعية حتى 2,000 مستلم في الحملة الواحدة</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>شات بوت ذكي بالذكاء الاصطناعي (AI Chatbot)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>سلوك بشري متطور ووقاية من الحظر</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>تكامل Google Sheets لإطلاق حملات مخصصة مباشرة من بيانات العملاء</span>
                </li>
              </ul>
            </div>
            <a href={currentUser ? '/dashboard/billing' : '/register?plan=pro'} className="btn-primary w-full text-center py-3 mt-8 text-xs font-bold transition-all cursor-pointer">
              {currentUser ? 'ترقية أو إدارة الباقة' : 'ابدأ الآن'}
            </a>
          </div>

          {/* Plan 3 */}
          <div className="glass-card flex flex-col justify-between text-right">
            <div>
              <h4 className="text-lg font-bold text-[#607d8b] mb-2">باقة الشركات (Enterprise)</h4>
              <div className="flex flex-col mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">25200</span>
                  <span className="text-xs text-[#607d8b]">جنيه مصري / سنوياً</span>
                </div>
                <span className="text-[10px] text-[#90a4ae] mt-1">ما يعادل 2100 جنيه مصري شهرياً (تدفع سنوياً)</span>
              </div>
              <p className="text-xs text-[#90a4ae] mb-6 leading-relaxed">للشركات الكبرى التي تحتاج إلى بنية تشغيل مخصصة وتجربة بيع ذكية مبنية على بيانات المنتجات.</p>
              <hr className="border-[rgba(255,255,255,0.04)] mb-6" />
              <ul className="flex flex-col gap-4 text-xs font-semibold text-[#90a4ae]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>10 أرقام واتساب منفصلة (10 Instances)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>شات بوت ذكي بالذكاء الاصطناعي (AI Chatbot)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>حد إرسال شهري حتى 600,000 رسالة صادرة</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>حملات جماعية حتى 10,000 مستلم في الحملة الواحدة</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>صندوق وارد مشترك للموظفين غير محدود</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#00ffa7]" />
                  <span>التعرف الذكي على المنتجات عبر Data Feed وتقديم توصيات دقيقة للعملاء</span>
                </li>
              </ul>
            </div>
            <a href={currentUser ? '/dashboard/billing' : '/register?plan=enterprise'} className="btn-secondary w-full text-center py-3 mt-8 text-xs font-bold transition-all cursor-pointer">
              {currentUser ? 'إدارة الاشتراك' : 'تواصل معنا'}
            </a>
          </div>
        </div>

        {/* Payment Gateways Banner Info */}
        <div className="glass-card mt-12 py-5 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-l-4 border-l-[#00ffa7] bg-[#00ffa7]/5 text-right">
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 justify-end sm:justify-start">
              <span>تفعيل فوري وتلقائي للاشتراك</span>
              <span className="indicator-online"></span>
            </h4>
            <p className="text-[11px] text-[#90a4ae] leading-relaxed">
              تدعم المنصة تأكيد المعاملات تلقائياً لـ <strong>فودافون كاش</strong> و <strong>إنستا باي (InstaPay)</strong> ليتم ترقية حسابك خلال ثوانٍ معدودة دون انتظار تأكيد يدوي.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold text-white bg-[#0e1622] px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.06)]">
            <span className="text-[#00ffa7]">فودافون كاش</span>
            <span className="text-white/[0.15]">|</span>
            <span className="text-[#00b0ff]">إنستا باي</span>
          </div>
        </div>
      </section>

      {/* --- FAQ Section --- */}
      <section id="faq" className="relative z-10 max-w-4xl mx-auto px-6 py-24 border-t border-[rgba(255,255,255,0.04)]">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold mb-4">الأسئلة الشائعة</h2>
          <p className="text-[#90a4ae]">تجد هنا إجابات سريعة على أبرز التساؤلات الفنية والمالية حول المنصة.</p>
        </div>

        <div className="flex flex-col gap-4">
          {faqs.map((faq, i) => (
            <div 
              key={i} 
              className="bg-[#0e1622] border border-[rgba(255,255,255,0.06)] rounded-xl overflow-hidden transition-all duration-300"
            >
              <button 
                onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                className="w-full p-5 flex items-center justify-between text-right font-bold text-sm md:text-base text-white hover:bg-white/[0.01] cursor-pointer bg-transparent"
              >
                <ChevronDown 
                  className={`w-5 h-5 flex-shrink-0 text-[#607d8b] transition-transform duration-300 ${
                    faqOpen === i ? 'rotate-180 text-[#00ffa7]' : ''
                  }`} 
                />
                <span className="flex-1 text-right">{faq.q}</span>
              </button>
              
              <div 
                className={`transition-all duration-300 overflow-hidden ${
                  faqOpen === i ? 'max-h-40 border-t border-[rgba(255,255,255,0.04)]' : 'max-h-0'
                }`}
              >
                <div className="p-5 text-xs md:text-sm text-[#90a4ae] leading-relaxed">
                  {faq.q === 'هل يمكنني تجنب حظر أرقام الواتساب عند الإرسال؟' ? (
                    <span>
                      نعم بالتأكيد! توفر المنصة ميزة محاكاة السلوك البشري من خلال إظهار حالة 
                      <span className="text-[#00ffa7] font-semibold"> "يكتب الآن..." </span> 
                      أو 
                      <span className="text-[#00ffa7] font-semibold"> "تسجيل مقطع صوتي..." </span> 
                      مع فترات تأخير عشوائية متغيرة بين كل رسالة وأخرى لضمان سلامة الرقم.
                    </span>
                  ) : faq.a}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* --- Footer --- */}
      <footer className="relative z-10 border-t border-[rgba(255,255,255,0.06)] bg-[#04080e] py-12 text-center text-xs text-[#607d8b]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ConvoBest" className="w-8 h-8 rounded-lg border border-[#00ffa7]/20 object-cover" />
            <span className="text-base font-bold text-white">ConvoBest</span>
          </div>

          <div className="flex flex-wrap justify-center gap-5 font-semibold text-[#90a4ae]">
            <a href="#features" className="hover:text-white">المميزات</a>
            <a href="#demo" className="hover:text-white">التجربة تفاعلية</a>
            <a href="#pricing" className="hover:text-white">الأسعار</a>
            <a href="/privacy" className="hover:text-white">سياسة الخصوصية</a>
            <a href="/terms" className="hover:text-white">الشروط والأحكام</a>
          </div>

          <div>جميع الحقوق محفوظة © {new Date().getFullYear()} لمنصة ConvoBest.</div>
        </div>
      </footer>
    </div>
  );
}
