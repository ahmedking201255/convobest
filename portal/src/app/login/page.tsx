'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, AlertCircle, CheckCircle, Smartphone, ChevronDown } from 'lucide-react';
import Link from 'next/link';

const countries = [
  { name: 'مصر', code: '20', flag: '🇪🇬' },
  { name: 'السعودية', code: '966', flag: '🇸🇦' },
  { name: 'الإمارات', code: '971', flag: '🇦🇪' },
  { name: 'الكويت', code: '965', flag: '🇰🇼' },
  { name: 'قطر', code: '974', flag: '🇶🇦' },
  { name: 'البحرين', code: '973', flag: '🇧🇭' },
  { name: 'عمان', code: '968', flag: '🇴🇲' },
  { name: 'الأردن', code: '962', flag: '🇯🇴' },
  { name: 'فلسطين', code: '970', flag: '🇵🇸' },
  { name: 'العراق', code: '964', flag: '🇮🇶' },
  { name: 'اليمن', code: '967', flag: '🇾🇪' },
  { name: 'السودان', code: '249', flag: '🇸🇩' },
  { name: 'ليبيا', code: '218', flag: '🇱🇾' },
  { name: 'المغرب', code: '212', flag: '🇲🇦' },
  { name: 'الجزائر', code: '213', flag: '🇩🇿' },
  { name: 'تونس', code: '216', flag: '🇹🇳' },
  { name: 'لبنان', code: '961', flag: '🇱🇧' },
  { name: 'سوريا', code: '963', flag: '🇸🇾' },
  { name: 'المملكة المتحدة', code: '44', flag: '🇬🇧' },
  { name: 'الولايات المتحدة', code: '1', flag: '🇺🇸' },
  { name: 'تركيا', code: '90', flag: '🇹🇷' },
];

export default function Login() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function checkSession() {
      try {
        const response = await fetch('/api/auth/session', {
          cache: 'no-store',
          signal: controller.signal,
        });
        const data = await response.json();

        if (response.ok && data.authenticated) {
          router.replace('/dashboard');
          router.refresh();
          return;
        }
      } catch (sessionError) {
        if (sessionError instanceof DOMException && sessionError.name === 'AbortError') return;
        console.error('Session check failed:', sessionError);
      }

      setCheckingSession(false);
    }

    checkSession();
    return () => controller.abort();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const localPhone = phone.replace(/\D/g, '').replace(/^0+/, '');
    if (localPhone.length < 7 || !password) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    const fullPhone = `${selectedCountry.code}${localPhone}`;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'فشل تسجيل الدخول. تحقق من البيانات');
      }

      setSuccess(true);
      setTimeout(() => {
        router.replace('/dashboard');
        router.refresh();
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-6">
        <div className="bg-grid"></div>
        <div key="checking-session-loader" className="relative z-10 flex flex-col items-center gap-4" role="status" aria-label="جاري التحقق من جلسة الحساب">
          <img src="/logo.png" alt="ConvoBest" className="w-14 h-14 rounded-xl shadow-lg shadow-[#00ffa7]/15" />
          <div className="h-1 w-28 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#00ffa7]" />
          </div>
          <span className="text-xs font-semibold text-[#90a4ae]">جاري التحقق من جلسة الحساب...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6">
      <div className="bg-grid"></div>

      <div key="login-form-card-wrapper" className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="ConvoBest" className="w-12 h-12 rounded-xl shadow-lg shadow-[#00ffa7]/15" />
            <span className="text-2xl font-black bg-gradient-to-r from-white via-white to-[#00ffa7] bg-clip-text text-transparent">ConvoBest</span>
          </Link>
          <h2 className="text-xl font-bold mt-4">تسجيل الدخول إلى حسابك</h2>
          <p className="text-xs text-[#90a4ae]">أدخل رقم الهاتف وكلمة المرور للوصول إلى حسابك</p>
        </div>

        {/* Form Card */}
        <div className="glass-card text-right">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-lg bg-[#00ffa7]/10 border border-[#00ffa7]/20 text-[#00ffa7] text-xs flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span>تم تسجيل الدخول بنجاح! يتم توجيهك الآن للوحة التحكم...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Phone Input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#90a4ae]">رقم الهاتف <span className="text-red-500">*</span></label>
              <div className="relative flex gap-2">
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setCountryDropdownOpen((open) => !open)}
                    className="flex h-12 items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0c121c] px-3 text-xs font-bold text-white transition-all hover:border-[#00ffa7]/40"
                    disabled={loading}
                    aria-label="اختيار مفتاح الدولة"
                    aria-expanded={countryDropdownOpen}
                  >
                    <ChevronDown className="h-3.5 w-3.5 text-[#607d8b]" />
                    <span className="font-mono">+{selectedCountry.code}</span>
                    <span className="text-lg">{selectedCountry.flag}</span>
                  </button>

                  {countryDropdownOpen && (
                    <div className="custom-scrollbar absolute right-0 top-full z-50 mt-1.5 flex max-h-60 w-52 flex-col gap-0.5 overflow-y-auto rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0c121c] p-1 shadow-2xl">
                      {countries.map((country) => (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(country);
                            setCountryDropdownOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-xs text-[#90a4ae] transition-all hover:bg-white/[0.04] hover:text-white ${selectedCountry.code === country.code ? 'bg-white/[0.03] font-bold text-white' : ''}`}
                        >
                          <span className="font-mono text-[10px] text-[#607d8b]">+{country.code}</span>
                          <span className="flex items-center gap-2">
                            <span>{country.name}</span>
                            <span className="text-base">{country.flag}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="relative min-w-0 flex-1">
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value.replace(/\D/g, ''))}
                    placeholder="1012345678"
                    className="input-premium h-12 w-full pr-12 text-left font-mono text-sm"
                    style={{ direction: 'ltr', paddingRight: '3rem' }}
                    disabled={loading}
                    required
                  />
                  <Smartphone className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#607d8b]" />
                </div>
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#90a4ae]">كلمة المرور <span className="text-red-500">*</span></label>
              <div className="relative">
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-premium pr-12 text-sm"
                  style={{ direction: 'ltr', paddingRight: '3rem' }}
                  disabled={loading}
                  required
                />
                <Lock className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#607d8b]" />
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading || success}
              className="btn-primary w-full py-3.5 mt-2 justify-center text-sm font-bold disabled:opacity-50"
            >
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>

            <div className="text-center mt-1">
              <Link href="/forgot-password" className="text-xs text-[#607d8b] hover:text-[#00ffa7] transition-all">نسيت كلمة المرور؟</Link>
            </div>
          </form>

          <div className="mt-6 text-center text-xs text-[#90a4ae]">
            <span>ليس لديك حساب؟ </span>
            <Link href="/register" className="text-[#00ffa7] hover:underline font-bold">إنشاء حساب جديد</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
