'use client';

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Zap, 
  Check, 
  Activity, 
  X, 
  Smartphone, 
  Send, 
  Loader2, 
  ShieldCheck, 
  AlertTriangle,
  HelpCircle,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import MonthlyUsageMeter from '@/components/monthly-usage-meter';

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExpired = searchParams.get('expired') === 'true';
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState('vodafone'); // vodafone, instapay
  const [senderAccount, setSenderAccount] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Polling State
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<'PENDING' | 'SUCCESSFUL' | 'FAILED' | null>(null);
  const [pollingError, setPollingError] = useState('');

  // Platform wallet details (Merchant details)
  const PLATFORM_VODAFONE_NUMBER = '01011198155';
  const PLATFORM_INSTAPAY_ADDRESS = '01011198155';

  const plans = [
    {
      id: 'Starter',
      name: 'Starter',
      price: 4800, // EGP per year (400 EGP/month)
      description: 'انطلاقة عملية للمتاجر الصغيرة التي تريد توحيد محادثات العملاء وأتمتة تحديثات الطلبات عبر واتساب.',
      features: [
        'ربط رقم واتساب واحد (1 Instance)',
        'حد إرسال شهري حتى 100,000 رسالة صادرة',
        'شات بوت أساسي بالكلمات المفتاحية',
        'حملات جماعية حتى 350 مستلم في الحملة الواحدة',
        'ربط المطورين والويب هوك',
        'تكامل WooCommerce لإرسال تحديثات الطلبات تلقائيا عبر واتساب'
      ]
    },
    {
      id: 'Pro',
      name: 'Pro',
      price: 9000, // EGP per year (750 EGP/month)
      description: 'للشركات النامية التي تحتاج إلى حملات أقوى، أتمتة متقدمة، واستفادة مباشرة من بيانات العملاء.',
      features: [
        '3 أرقام واتساب منفصلة (3 Instances)',
        'حد إرسال شهري حتى 200,000 رسالة صادرة',
        'حملات جماعية حتى 2,000 مستلم في الحملة الواحدة',
        'شات بوت ذكي بالذكاء الاصطناعي (AI Chatbot)',
        'سلوك بشري متطور ووقاية من الحظر',
        'تكامل Google Sheets لإطلاق حملات مخصصة مباشرة من بيانات العملاء'
      ]
    },
    {
      id: 'Enterprise',
      name: 'Enterprise',
      price: 25200, // EGP per year (2100 EGP/month)
      description: 'للشركات الكبرى التي تحتاج إلى بنية تشغيل مخصصة وتجربة بيع ذكية مبنية على بيانات المنتجات.',
      features: [
        '10 أرقام واتساب منفصلة (10 Instances)',
        'شات بوت ذكي بالذكاء الاصطناعي (AI Chatbot)',
        'حد إرسال شهري حتى 600,000 رسالة صادرة',
        'حملات جماعية حتى 10,000 مستلم في الحملة الواحدة',
        'صندوق وارد مشترك للموظفين غير محدود',
        'التعرف الذكي على المنتجات عبر Data Feed وتقديم توصيات دقيقة للعملاء'
      ]
    }
  ];

  async function fetchSession() {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setSession(data.user);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSession();
  }, []);

  // Poll transaction status
  useEffect(() => {
    if (!transactionId || pollingStatus === 'SUCCESSFUL') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/billing/checkout?id=${transactionId}`);
        const data = await res.json();
        
        if (res.ok) {
          setPollingStatus(data.status);
          if (data.status === 'SUCCESSFUL') {
            clearInterval(interval);
            // Refresh session to get updated subscription plan
            fetchSession();
          }
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [transactionId, pollingStatus]);

  const handleOpenCheckout = (plan: any) => {
    setSelectedPlan(plan);
    setPaymentMethod('vodafone');
    setSenderAccount('');
    setCheckoutError('');
    setTransactionId(null);
    setPollingStatus(null);
    setCheckoutModalOpen(true);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderAccount) {
      setCheckoutError('يرجى إدخال رقم محفظتك أو حساب إنستاباي لتأكيد التحويل');
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError('');

    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan.id,
          amount: selectedPlan.price,
          senderAccount
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit payment verification request');

      setTransactionId(data.transactionId);
      setPollingStatus('PENDING');
    } catch (err: any) {
      setCheckoutError(err.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ffa7] to-[#00b0ff] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#060b11] animate-spin" />
          </div>
          <span className="text-xs text-[#90a4ae]">جاري تحميل إعدادات الفوترة والاشتراكات...</span>
        </div>
      </div>
    );
  }

  const currentPlan = session?.subscription?.plan || 'Starter (Trial)';
  const expiryDate = session?.subscription?.endDate;

  // Determine current user's plan level
  let currentLevel = 0; // default/trial
  if (currentPlan.includes('Enterprise')) {
    currentLevel = 3;
  } else if (currentPlan.includes('Pro')) {
    currentLevel = 2;
  } else if (currentPlan.includes('Starter')) {
    if (currentPlan.includes('Trial')) {
      currentLevel = 0;
    } else {
      currentLevel = 1;
    }
  }

  return (
    <>
      <div className="flex flex-col gap-8 text-right animate-fade-in relative">
        
        {/* Title */}
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">إعدادات الفوترة والترقية</h1>
          <p className="text-xs text-[#90a4ae] mt-1">اختر الباقة المناسبة لحجم أعمالك. باقات مرنة تدعم التحويل والتفعيل التلقائي الفوري.</p>
        </div>

        {/* Expired Warning Banner */}
        {isExpired && (
          <div className="p-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex flex-col gap-2.5 text-right animate-pulse">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-red-500" />
              <span className="font-black text-white text-sm">انتهت صلاحية باقتك التجريبية!</span>
            </div>
            <p className="leading-relaxed text-[#90a4ae]">
              انتهت فترة الاشتراك التجريبية المجانية الخاصة بك (3 أيام). تم إيقاف وقطع اتصال جميع أرقام الواتساب التابعة لحسابك تلقائياً لمنع الاستهلاك.
              يرجى اختيار وتفعيل إحدى الباقات المدفوعة أدناه لتتمكن من استعادة الاتصال واستخدام كامل ميزات المنصة مرة أخرى.
            </p>
          </div>
        )}

        {/* Current Plan Overview widget */}
        <div className="glass-card flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-4 border-l-[#00ffa7] bg-[#00ffa7]/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00ffa7]/10 flex items-center justify-center border border-[#00ffa7]/20 text-[#00ffa7]">
              <Zap className="w-6 h-6 text-glow-primary" />
            </div>
            <div className="text-right">
              <h3 className="text-lg font-bold text-white">باقة الاشتراك الحالية: <span className="text-[#00ffa7]">{currentPlan}</span></h3>
              <p className="text-xs text-[#90a4ae] mt-1" suppressHydrationWarning>
                {expiryDate 
                  ? `تاريخ انتهاء باقتك الحالية: ${new Date(expiryDate).toLocaleDateString('ar-EG')}`
                  : 'اشتراك تجريبي مجاني نشط.'}
              </p>
            </div>
          </div>
          <div className="text-xs font-bold text-white bg-[#0e1622] px-4 py-2 rounded-xl border border-[rgba(255,255,255,0.06)] self-start md:self-auto">
            <span>الاشتراك نشط</span>
          </div>
        </div>

        {/* Plans Grid list */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((p) => {
            const planLevel = p.id === 'Enterprise' ? 3 : p.id === 'Pro' ? 2 : p.id === 'Starter' ? 1 : 0;
            const isCurrent = currentPlan.includes(p.id) && !currentPlan.includes('Trial');

            let buttonText = 'اشترك أو جدد الآن';
            let isDisabled = false;
            let btnClass = 'btn-primary';

            if (currentLevel === planLevel) {
              buttonText = 'أنت بالفعل مشترك في هذه الباقة';
              isDisabled = true;
              btnClass = 'btn-secondary opacity-60 cursor-not-allowed';
            } else if (currentLevel > planLevel) {
              buttonText = 'أنت تمتلك باقة أعلى بالفعل';
              isDisabled = true;
              btnClass = 'bg-[#0e1622] text-[#607d8b] border border-[rgba(255,255,255,0.04)] cursor-not-allowed opacity-50';
            } else {
              // currentLevel < planLevel
              if (currentLevel === 0) {
                buttonText = 'اشترك الآن';
                isDisabled = false;
                btnClass = 'btn-primary';
              } else {
                buttonText = 'ترقية';
                isDisabled = false;
                btnClass = 'btn-primary bg-gradient-to-r from-[#00ffa7] to-[#00b0ff]';
              }
            }

            return (
              <div 
                key={p.id} 
                className={`glass-card flex flex-col justify-between text-right transition-all relative ${
                  isCurrent ? 'border-[#00ffa7]/30 shadow-2xl' : ''
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#00ffa7]/15 text-[#00ffa7] text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-[#00ffa7]/30">
                    الباقة النشطة حالياً
                  </div>
                )}
                <div>
                  <h4 className="text-lg font-bold text-white mb-2">{p.name}</h4>
                  <div className="flex flex-col mb-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-[#00ffa7]">{p.price}</span>
                      <span className="text-xs text-[#90a4ae] font-bold">جنيه مصري / سنوياً</span>
                    </div>
                    <span className="text-[10px] text-[#607d8b] mt-1">ما يعادل {Math.round(p.price / 12)} جنيه مصري شهرياً</span>
                  </div>
                  <p className="text-xs text-[#90a4ae] mb-6 leading-relaxed">{p.description}</p>
                  
                  <hr className="border-[rgba(255,255,255,0.04)] mb-6" />
                  
                  <ul className="flex flex-col gap-3 text-xs text-[#90a4ae]">
                    {p.features.map((feat, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-[#00ffa7] flex-shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <button
                  onClick={() => handleOpenCheckout(p)}
                  className={`w-full text-center py-3 mt-8 text-xs font-bold transition-all ${btnClass}`}
                  disabled={isDisabled}
                >
                  {buttonText}
                </button>
              </div>
            );
          })}
        </div>

      </div>

      {/* --- CHECKOUT SUBSCRIPTION MODAL (Fragment level) --- */}
      {checkoutModalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (pollingStatus !== 'PENDING') setCheckoutModalOpen(false);
            }}
          ></div>
          
          <div className="relative z-10 w-full max-w-md bg-[#0e1622] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-2xl animate-fade-in text-right">
            
            {/* Header */}
            <div className="bg-[#0c0f16] px-6 py-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.04)]">
              {pollingStatus !== 'PENDING' ? (
                <button 
                  onClick={() => setCheckoutModalOpen(false)}
                  className="text-[#607d8b] hover:text-white transition-all bg-transparent"
                >
                  <X className="w-5 h-5" />
                </button>
              ) : <div className="w-5"></div>}
              
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>تأكيد الاشتراك - باقة {selectedPlan.name}</span>
              </h3>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              
              {/* Step 1: Form & Payment Instructions */}
              {!pollingStatus && (
                <form onSubmit={handleCheckoutSubmit} className="flex flex-col gap-5">
                  
                  {checkoutError && (
                    <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0" />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  {/* Payment Methods selector tabs */}
                  <div className="grid grid-cols-2 gap-3 bg-[#0c121c] p-1.5 rounded-xl border border-[rgba(255,255,255,0.03)]">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('instapay')}
                      className={`py-2 px-4 rounded-lg text-xs font-bold transition-all text-center ${
                        paymentMethod === 'instapay'
                          ? 'bg-[#00b0ff]/10 text-[#00b0ff] border border-[#00b0ff]/20'
                          : 'text-[#607d8b] hover:text-white'
                      }`}
                    >
                      إنستا باي (InstaPay)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('vodafone')}
                      className={`py-2 px-4 rounded-lg text-xs font-bold transition-all text-center ${
                        paymentMethod === 'vodafone'
                          ? 'bg-[#00ffa7]/10 text-[#00ffa7] border border-[#00ffa7]/20'
                          : 'text-[#607d8b] hover:text-white'
                      }`}
                    >
                      فودافون كاش
                    </button>
                  </div>

                  {/* Payment instructions */}
                  <div className="bg-[#060b11]/80 rounded-xl p-4 border border-[rgba(255,255,255,0.03)] text-right">
                    <span className="text-[10px] text-[#00ffa7] font-bold">تعليمات التحويل والفوترة:</span>
                    <p className="text-xs text-white mt-1.5 leading-relaxed">
                      يرجى تحويل مبلغ <strong className="text-white text-sm font-black underline">{selectedPlan.price} جنيه مصري</strong> إلى:
                    </p>
                    <div className="bg-[#0e1622] p-3 rounded-lg border border-[rgba(255,255,255,0.04)] mt-3 flex items-center justify-between">
                      <span className="text-[10px] text-[#607d8b]">انسخ العنوان</span>
                      <strong className="text-white text-sm font-mono tracking-widest">
                        {paymentMethod === 'vodafone' ? PLATFORM_VODAFONE_NUMBER : PLATFORM_INSTAPAY_ADDRESS}
                      </strong>
                    </div>
                    <p className="text-[10px] text-[#607d8b] mt-3 leading-relaxed">
                      * قم بالتحويل من محفظتك أو حسابك البنكي، ثم أدخل رقم محفظتك أو حساب إنستاباي أدناه الذي قمت بالتحويل منه لنقوم بالمطابقة التلقائية.
                    </p>
                  </div>

                  {/* Input sender account */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-[#90a4ae]">
                      {paymentMethod === 'vodafone' 
                        ? 'رقم المحفظة التي قمت بالتحويل منها (11 رقم)' 
                        : 'عنوان إنستاباي أو اسم الحساب المرسل منه'}
                    </label>
                    <div className="relative">
                      <input 
                        type="text"
                        placeholder={paymentMethod === 'vodafone' ? '010XXXXXXXX' : 'username@instapay'}
                        value={senderAccount}
                        onChange={(e) => setSenderAccount(e.target.value)}
                        className="input-premium text-xs text-left"
                        style={{ direction: 'ltr' }}
                        disabled={checkoutLoading}
                        required
                      />
                      <Smartphone className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#607d8b]" />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="btn-primary py-3.5 text-xs font-bold justify-center"
                    disabled={checkoutLoading}
                  >
                    {checkoutLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin ml-1" />
                    ) : (
                      <>
                        <span>أرسل لتأكيد الدفع التلقائي</span>
                        <Send className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </button>

                </form>
              )}

              {/* Step 2: Real-time confirmation Loader */}
              {pollingStatus === 'PENDING' && (
                <div className="py-12 flex flex-col items-center text-center gap-6 animate-pulse">
                  <div className="w-16 h-16 rounded-full border-[3px] border-t-[#00ffa7] border-r-transparent border-b-[#00b0ff] border-l-transparent animate-spin flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-[#90a4ae]" />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-base font-bold text-white">جاري التحقق من عملية التحويل...</h3>
                    <p className="text-xs text-[#90a4ae] max-w-xs leading-relaxed">
                      يستمع النظام الآن لرسالة تأكيد التحويل (SMS) الواردة على المحفظة. سيتم تفعيل حسابك تلقائياً فور وصولها.
                    </p>
                  </div>

                  <div className="bg-[#0c121c] p-3 rounded-lg border border-[rgba(255,255,255,0.03)] text-right w-full flex items-center justify-between text-[11px] text-[#607d8b]">
                    <span>حالة المعاملة:</span>
                    <span className="text-[#ff9100] font-bold flex items-center gap-1.5">
                      بانتظار الإيداع
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ff9100] animate-ping"></span>
                    </span>
                  </div>
                </div>
              )}

              {/* Step 3: Success Confirmation screen */}
              {pollingStatus === 'SUCCESSFUL' && (
                <div className="py-12 flex flex-col items-center text-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-[#00ffa7]/10 border border-[#00ffa7]/20 flex items-center justify-center text-[#00ffa7] animate-float">
                    <CheckCircle2 className="w-9 h-9 text-glow-primary" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-lg font-black text-white">تم تأكيد الدفع والاشتراك بنجاح!</h3>
                    <p className="text-xs text-[#90a4ae] max-w-xs leading-relaxed">
                      مبروك! تم التحقق من عملية التحويل وتفعيل باقة الاشتراك الخاصة بك (<strong className="text-white">{selectedPlan.name}</strong>) لمدة 30 يوماً إضافية.
                    </p>
                  </div>

                  <button
                    onClick={() => setCheckoutModalOpen(false)}
                    className="btn-primary py-3 px-8 text-xs font-bold"
                  >
                    اذهب واستكشف لوحة التحكم
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </>
  );
}
