'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Key, AlertCircle, CheckCircle, ArrowRight, Smartphone, Check, ChevronDown } from 'lucide-react';
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
  { name: 'تركيا', code: '90', flag: '🇹🇷' }
];

export default function ForgotPassword() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Send OTP, 2: Reset Password
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const getFullPhone = () => {
    let cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.startsWith('0')) {
      cleanDigits = cleanDigits.substring(1);
    }
    return `${selectedCountry.code}${cleanDigits}`;
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) {
      setError('يرجى إدخال رقم الهاتف');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const fullPhone = getFullPhone();

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'حدث خطأ ما أثناء إرسال رمز التحقق');
      }

      setSuccess(data.message || 'تم إرسال رمز التحقق OTP بنجاح! يرجى فحص الواتساب الخاص بك.');

      setTimeout(() => {
        setStep(2);
        setSuccess('');
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || !password || !confirmPassword) {
      setError('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (password !== confirmPassword) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقين');
      return;
    }

    if (password.length < 6) {
      setError('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const fullPhone = getFullPhone();

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: fullPhone, otpCode, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'فشل إعادة تعيين كلمة المرور');
      }

      setSuccess('تم تعيين كلمة المرور بنجاح! يتم تحويلك الآن لصفحة تسجيل الدخول...');

      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-6">
      <div className="bg-grid"></div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center gap-3 mb-8 text-center">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="ConvoBest" className="w-12 h-12 rounded-xl shadow-lg shadow-[#00ffa7]/15" />
            <span className="text-2xl font-black bg-gradient-to-r from-white via-white to-[#00ffa7] bg-clip-text text-transparent">ConvoBest</span>
          </Link>
          <h2 className="text-xl font-bold mt-4">استعادة الوصول إلى حسابك</h2>
          <p className="text-xs text-[#90a4ae]">
            {step === 1 
              ? 'أدخل رقم الهاتف وسنرسل لك رمز OTP عبر واتساب لإعادة تعيين كلمة المرور' 
              : 'أدخل الرمز المستلم واكتب كلمة المرور الجديدة'}
          </p>
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
              <span>{success}</span>
            </div>
          )}



          {step === 1 ? (
            /* Step 1: Send OTP Form */
            <form onSubmit={handleSendOtp} className="flex flex-col gap-5">
              
              {/* Phone Input with Country Code Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#90a4ae]">رقم الهاتف (الواتساب) <span className="text-red-500">*</span></label>
                <div className="flex gap-2 relative">
                  
                  {/* Country Code Dropdown Button */}
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                      className="flex items-center gap-1.5 h-12 px-3 bg-[#0c121c] border border-[rgba(255,255,255,0.06)] rounded-xl text-white text-xs hover:border-[#00ffa7]/40 transition-all font-bold"
                      disabled={loading}
                    >
                      <ChevronDown className="w-3.5 h-3.5 text-[#607d8b]" />
                      <span className="font-mono">+{selectedCountry.code}</span>
                      <span className="text-lg">{selectedCountry.flag}</span>
                    </button>

                    {/* Floating Dropdown List */}
                    {countryDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1.5 z-50 w-48 max-h-60 overflow-y-auto bg-[#0c121c] border border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl backdrop-blur-md p-1 flex flex-col gap-0.5 custom-scrollbar">
                        {countries.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setSelectedCountry(c);
                              setCountryDropdownOpen(false);
                            }}
                            className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-right text-xs transition-all hover:bg-white/[0.04] text-[#90a4ae] hover:text-white ${
                              selectedCountry.code === c.code ? 'bg-white/[0.03] text-white font-bold' : ''
                            }`}
                          >
                            <span className="font-mono text-[10px] text-[#607d8b]">+{c.code}</span>
                            <span className="flex items-center gap-2">
                              <span>{c.name}</span>
                              <span className="text-base">{c.flag}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Phone Digits Input */}
                  <div className="relative flex-1">
                    <input 
                      type="text" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="1012345678"
                      className="input-premium pr-12 text-sm text-left font-mono h-12 w-full"
                      style={{ direction: 'ltr', paddingRight: '3rem' }}
                      disabled={loading}
                      required
                    />
                    <Smartphone className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#607d8b]" />
                  </div>

                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="btn-primary w-full py-3.5 mt-2 justify-center text-sm font-bold disabled:opacity-50"
              >
                {loading ? 'جاري إرسال الرمز...' : 'إرسال رمز التحقق OTP'}
              </button>
            </form>
          ) : (
            /* Step 2: Reset Password Form */
            <form onSubmit={handleResetPassword} className="flex flex-col gap-5">
              {/* OTP Code Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#90a4ae]">رمز التحقق OTP <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                    placeholder="أدخل الرمز المكون من 6 أرقام"
                    className="input-premium pr-12 text-sm text-center font-mono tracking-[0.5em] h-12 w-full"
                    style={{ direction: 'ltr', paddingRight: '3rem' }}
                    disabled={loading}
                    required
                  />
                  <Key className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#607d8b]" />
                </div>
              </div>

              {/* New Password Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#90a4ae]">كلمة المرور الجديدة <span className="text-red-500">*</span></label>
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

              {/* Confirm Password Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#90a4ae]">تأكيد كلمة المرور الجديدة <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-premium pr-12 text-sm"
                    style={{ direction: 'ltr', paddingRight: '3rem' }}
                    disabled={loading}
                    required
                  />
                  <Lock className="absolute right-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#607d8b]" />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="btn-primary w-full py-3.5 mt-2 justify-center text-sm font-bold disabled:opacity-50"
              >
                {loading ? 'جاري إعادة التعيين...' : 'إعادة تعيين كلمة المرور'}
              </button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center justify-center gap-1.5 text-xs text-[#ff9100] hover:text-white mt-1 transition-all bg-transparent border-none cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>الرجوع لتعديل رقم الهاتف</span>
              </button>
            </form>
          )}

          <div className="mt-6 text-center text-xs text-[#90a4ae]">
            <span>الرجوع إلى </span>
            <Link href="/login" className="text-[#00ffa7] hover:underline font-bold">تسجيل الدخول</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
