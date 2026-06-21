'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Shield, AlertTriangle, Check, RefreshCw } from 'lucide-react';

export default function AdminSettingsPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [otpSenderInstanceId, setOtpSenderInstanceId] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch settings & instances
  async function fetchSettings() {
    try {
      setLoading(true);
      setError('');
      
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'فشل تحميل الإعدادات');
      
      setInstances(data.instances || []);
      setOtpSenderInstanceId(data.settings?.otpSenderInstanceId || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpSenderInstanceId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ الإعدادات');

      setSuccess('تم حفظ إعدادات النظام بنجاح!');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff9100] to-[#ff3d00] flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-[#060b11] animate-spin" />
          </div>
          <span className="text-xs text-[#90a4ae]">جاري تحميل إعدادات النظام...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 text-right animate-fade-in">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3 justify-start">
          <Settings className="w-8 h-8 text-[#ff9100]" />
          <span>إعدادات النظام</span>
        </h1>
        <p className="text-xs text-[#90a4ae] mt-1">تكوين وتعيين خيارات النظام الأساسية وأرقام الإرسال المعتمدة لرموز التحقق.</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-[#00ffa7]/10 border border-[#00ffa7]/20 text-[#00ffa7] text-xs flex items-center gap-2">
          <Check className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 gap-6">
        
        {/* Settings Card */}
        <div className="glass-card flex flex-col gap-6 p-6 border-l-4 border-l-[#ff9100]">
          
          <div className="flex items-center gap-3 justify-start border-b border-[rgba(255,255,255,0.04)] pb-4">
            <div className="w-10 h-10 rounded-xl bg-[#ff9100]/10 flex items-center justify-center border border-[#ff9100]/20 text-[#ff9100]">
              <Shield className="w-5 h-5" />
            </div>
            <div className="text-right">
              <h3 className="text-sm font-bold text-white">إعدادات التحقق بالـ OTP</h3>
              <p className="text-[10px] text-[#607d8b] mt-0.5">تحديد رقم البث الخاص بالمنصة لإرسال كود الـ OTP للعملاء عند التسجيل أو استعادة كلمة المرور.</p>
            </div>
          </div>

          {/* Connected instances select */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-[#90a4ae]">رقم إرسال الـ OTP (من حسابات الأدمن المتصلة)</label>
            {instances.length === 0 ? (
              <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs flex flex-col gap-2 text-right">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <span className="font-bold text-white">تنبيه: لا يوجد أرقام واتساب متصلة حالياً بحساب الأدمن</span>
                </div>
                <span>لتتمكن من إرسال كود التحقق OTP للعملاء، يجب أولاً ربط وتوصيل رقم هاتف واتساب واحد على الأقل تحت حساب الأدمن بالمنصة (CONNECTED)، ثم الدخول هنا لتعيينه.</span>
              </div>
            ) : (
              <select
                value={otpSenderInstanceId}
                onChange={(e) => setOtpSenderInstanceId(e.target.value)}
                className="input-premium h-12 text-sm text-right"
                disabled={saving}
              >
                <option value="">-- اختر رقم إرسال الـ OTP --</option>
                {instances.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name} ({inst.number}) - متصل
                  </option>
                ))}
              </select>
            )}
            <span className="text-[10px] text-[#607d8b]">
              ملاحظة: سيتم إرسال كود التحقق OTP بالواتساب تلقائياً من خلال هذا الرقم عند قيام أي عميل بإنشاء حساب جديد أو طلب استعادة كلمة المرور.
            </span>
          </div>

        </div>

        {/* Submit Button */}
        <div className="flex justify-start">
          <button
            type="submit"
            disabled={saving || (instances.length === 0 && !otpSenderInstanceId)}
            className="btn-primary py-3 px-8 text-xs font-bold bg-gradient-to-r from-[#ff9100] to-[#ff3d00] hover:from-[#ff9100]/95 hover:to-[#ff3d00]/95 shadow-lg shadow-[#ff9100]/10 border-none"
          >
            {saving ? 'جاري حفظ الإعدادات...' : 'حفظ التغييرات'}
          </button>
        </div>

      </form>
    </div>
  );
}
