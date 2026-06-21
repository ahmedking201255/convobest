'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Check, 
  X, 
  ShoppingBag, 
  Copy, 
  RefreshCw, 
  Download,
  Info,
  Save
} from 'lucide-react';
import Link from 'next/link';

export default function WooCommercePage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [loadingInstances, setLoadingInstances] = useState(true);

  // User session
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // WooCommerce config state
  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [enabled, setEnabled] = useState(false);
  const [orderCreatedTemplate, setOrderCreatedTemplate] = useState('');
  const [orderProcessingTemplate, setOrderProcessingTemplate] = useState('');
  const [orderCompletedTemplate, setOrderCompletedTemplate] = useState('');

  // Copy status indicators
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Fetch Session and Connected Instances on mount
  useEffect(() => {
    async function fetchSessionAndInstances() {
      try {
        // 1. Fetch Session
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        if (sessionRes.ok && sessionData.authenticated) {
          setSession(sessionData.user);
        }

        // 2. Fetch Instances
        const res = await fetch('/api/instances');
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          const connectedOnly = data.filter((inst: any) => inst.status === 'CONNECTED');
          setInstances(connectedOnly);
          if (connectedOnly.length > 0) {
            setSelectedInstanceId(connectedOnly[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingSession(false);
        setLoadingInstances(false);
      }
    }
    fetchSessionAndInstances();
  }, []);

  // Fetch WooCommerce config
  const fetchConfig = useCallback(async (instanceId: string) => {
    setLoadingConfig(true);
    setError('');
    try {
      const res = await fetch(`/api/integration/woocommerce/config?instanceId=${instanceId}`);
      const data = await res.json();
      if (res.ok && data.config) {
        setConfig(data.config);
        setEnabled(data.config.enabled);
        setOrderCreatedTemplate(data.config.orderCreatedTemplate);
        setOrderProcessingTemplate(data.config.orderProcessingTemplate);
        setOrderCompletedTemplate(data.config.orderCompletedTemplate);
      } else {
        setError(data.error || 'فشل تحميل إعدادات ووكومرس');
      }
    } catch (err: any) {
      console.error(err);
      setError('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  // Trigger fetch when instance changes
  useEffect(() => {
    if (selectedInstanceId) {
      fetchConfig(selectedInstanceId);
    }
  }, [selectedInstanceId, fetchConfig]);

  // Handle saving WooCommerce config
  const handleSaveConfig = async (regenerateKey = false) => {
    if (!selectedInstanceId || savingConfig) return;

    setSavingConfig(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/integration/woocommerce/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          enabled,
          orderCreatedTemplate,
          orderProcessingTemplate,
          orderCompletedTemplate,
          regenerateApiKey: regenerateKey
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ الإعدادات');

      setConfig(data.config);
      setEnabled(data.config.enabled);
      setOrderCreatedTemplate(data.config.orderCreatedTemplate);
      setOrderProcessingTemplate(data.config.orderProcessingTemplate);
      setOrderCompletedTemplate(data.config.orderCompletedTemplate);
      setSuccess(regenerateKey ? 'تم إعادة توليد مفتاح الربط وحفظ الإعدادات بنجاح' : 'تم حفظ إعدادات ووكومرس بنجاح');
      
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const copyToClipboard = (text: string, isUrl: boolean) => {
    navigator.clipboard.writeText(text);
    if (isUrl) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/integration/woocommerce` 
    : 'http://localhost:3000/api/integration/woocommerce';

  if (loadingInstances || loadingSession) {
    return (
      <div className="h-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ffa7] to-[#00b0ff] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#060b11] animate-spin" />
          </div>
          <span className="text-xs text-[#90a4ae]">جاري تهيئة إعدادات ربط ووكومرس...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 text-right animate-fade-in relative" dir="rtl">
      
      {/* Top Header Block */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-shrink-0">
        <div className="text-right">
          <h1 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-[#00ffa7]" />
            <span>ربط وتكامل WooCommerce</span>
          </h1>
          <p className="text-[10px] text-[#90a4ae] mt-1">اربط متجرك الإلكتروني لإرسال تنبيهات وإشعارات فورية لعملائك بالواتساب تلقائياً.</p>
        </div>

        {instances.length > 0 && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <label className="text-[10px] font-bold text-[#90a4ae] whitespace-nowrap">الرقم المربوط النشط:</label>
            <select 
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
              className="bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-white rounded-xl px-3 py-2 text-xs outline-none transition-all cursor-pointer w-full sm:w-auto font-mono"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {instances.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center text-center py-16 px-6 gap-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="flex flex-col gap-1.5 max-w-md">
            <h3 className="text-lg font-bold text-white">لم تقم بربط أي رقم هاتف متصل حالياً</h3>
            <p className="text-xs text-[#90a4ae] leading-relaxed">
              لتفعيل ربط متاجر ووكومرس، يجب أولاً ربط رقم هاتف واتساب واحد على الأقل وتفعيل اتصاله بالمسح الضوئي للـ QR.
            </p>
          </div>
          <Link href="/dashboard/instances" className="btn-primary text-xs font-bold py-3 px-6">
            اذهب لربط رقم واتساب بالمسح الضوئي
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main settings panel */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Status alerts */}
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-4 rounded-xl bg-[#00ffa7]/10 border border-[#00ffa7]/20 text-[#00ffa7] text-xs flex items-center gap-3">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Config Card */}
            <div className="glass-card flex flex-col gap-6">
              
              {/* Toggle switch */}
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.04)] pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">حالة تشغيل التكامل مع ووكومرس</h3>
                  <p className="text-[10px] text-[#607d8b]">قم بتشغيل أو إيقاف استلام إشعارات الطلبات على هذا الرقم.</p>
                </div>
                <button
                  onClick={() => setEnabled(!enabled)}
                  className={`relative w-12 h-6.5 rounded-full p-1 transition-colors duration-300 outline-none ${
                    enabled ? 'bg-[#00ffa7]' : 'bg-[#121e2a] border border-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  <span
                    className={`block w-4.5 h-4.5 rounded-full transition-transform duration-300 transform ${
                      enabled ? '-translate-x-5.5 bg-[#060b11]' : 'translate-x-0 bg-[#607d8b]'
                    }`}
                  />
                </button>
              </div>

              {loadingConfig ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                  <Activity className="w-5 h-5 text-[#00ffa7] animate-spin" />
                  <span className="text-[9px] text-[#607d8b]">جاري جلب إعدادات الربط...</span>
                </div>
              ) : (
                <>
                  {/* Webhook details */}
                  <div className="flex flex-col gap-4 bg-[#070c14]/40 border border-[rgba(255,255,255,0.03)] p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5 flex-row-reverse justify-end">
                      <Info className="w-4 h-4 text-[#00b0ff]" />
                      <span>بيانات ربط موقع ووردبريس الخاص بك</span>
                    </h4>

                    {/* Webhook URL field */}
                    <div className="flex flex-col gap-1.5 text-right">
                      <label className="text-[9px] font-bold text-[#607d8b]">رابط الويب هوك (Webhook URL)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={webhookUrl}
                          className="flex-1 bg-[#060b11] border border-[rgba(255,255,255,0.06)] text-xs text-white/70 font-mono rounded-xl px-3 py-2.5 outline-none text-left"
                        />
                        <button 
                          onClick={() => copyToClipboard(webhookUrl, true)}
                          className="w-10 rounded-xl bg-[#121e2a] border border-[rgba(255,255,255,0.06)] flex items-center justify-center hover:bg-[#00ffa7]/10 hover:border-[#00ffa7]/20 hover:text-[#00ffa7] transition-all cursor-pointer"
                          title="نسخ الرابط"
                        >
                          {copiedUrl ? <Check className="w-4 h-4 text-[#00ffa7]" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* API Key field */}
                    <div className="flex flex-col gap-1.5 text-right">
                      <label className="text-[9px] font-bold text-[#607d8b]">مفتاح الربط الفريد (Integration API Key)</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          readOnly 
                          value={config?.apiKey || ''}
                          className="flex-1 bg-[#060b11] border border-[rgba(255,255,255,0.06)] text-xs text-white/70 font-mono rounded-xl px-3 py-2.5 outline-none text-left"
                        />
                        <button 
                          onClick={() => copyToClipboard(config?.apiKey || '', false)}
                          className="w-10 rounded-xl bg-[#121e2a] border border-[rgba(255,255,255,0.06)] flex items-center justify-center hover:bg-[#00ffa7]/10 hover:border-[#00ffa7]/20 hover:text-[#00ffa7] transition-all cursor-pointer"
                          title="نسخ المفتاح"
                        >
                          {copiedKey ? <Check className="w-4 h-4 text-[#00ffa7]" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button 
                          onClick={() => {
                            if(confirm('هل أنت متأكد من رغبتك في إعادة توليد مفتاح الربط؟ سيتوقف الربط القديم فوراً حتى تقوم بتحديثه في موقعك.')) {
                              handleSaveConfig(true);
                            }
                          }}
                          className="w-10 rounded-xl bg-[#121e2a] border border-[rgba(255,255,255,0.06)] flex items-center justify-center hover:bg-[#00b0ff]/10 hover:border-[#00b0ff]/20 hover:text-[#00b0ff] transition-all cursor-pointer"
                          title="إعادة توليد المفتاح"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Templates Customization */}
                  <div className="flex flex-col gap-5">
                    <h3 className="text-xs font-bold text-white border-b border-[rgba(255,255,255,0.04)] pb-2">صياغة قوالب رسائل الواتساب</h3>

                    {/* Template 1: Order Created */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-[#90a4ae]">قالب رسالة إنشاء طلب جديد (Order Pending/Created)</label>
                        <span className="text-[8px] text-[#607d8b]">عند دخول الطلب قيد الانتظار</span>
                      </div>
                      <textarea 
                        value={orderCreatedTemplate}
                        onChange={(e) => setOrderCreatedTemplate(e.target.value)}
                        rows={3}
                        className="w-full bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-xs text-white rounded-xl px-4 py-3 outline-none resize-none transition-all"
                        placeholder="صيغة رسالة طلب جديد..."
                      />
                    </div>

                    {/* Template 2: Order Processing */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-[#90a4ae]">قالب رسالة معالجة الطلب (Order Processing)</label>
                        <span className="text-[8px] text-[#607d8b]">عند بدء تحضير الطلب والشحن</span>
                      </div>
                      <textarea 
                        value={orderProcessingTemplate}
                        onChange={(e) => setOrderProcessingTemplate(e.target.value)}
                        rows={3}
                        className="w-full bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-xs text-white rounded-xl px-4 py-3 outline-none resize-none transition-all"
                        placeholder="صيغة رسالة تحضير الطلب..."
                      />
                    </div>

                    {/* Template 3: Order Completed */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-[#90a4ae]">قالب رسالة اكتمال الطلب (Order Completed)</label>
                        <span className="text-[8px] text-[#607d8b]">عند اكتمال التسليم أو نجاح الشحن</span>
                      </div>
                      <textarea 
                        value={orderCompletedTemplate}
                        onChange={(e) => setOrderCompletedTemplate(e.target.value)}
                        rows={3}
                        className="w-full bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-xs text-white rounded-xl px-4 py-3 outline-none resize-none transition-all"
                        placeholder="صيغة رسالة اكتمال الطلب..."
                      />
                    </div>

                    {/* Variables Tips */}
                    <div className="bg-[#0e1622]/50 border border-[rgba(255,255,255,0.03)] p-3.5 rounded-xl text-[10px] text-[#90a4ae] leading-relaxed flex flex-col gap-1.5">
                      <span className="font-bold text-white flex items-center gap-1.5 flex-row-reverse justify-end">
                        <Info className="w-3.5 h-3.5 text-[#00ffa7]" />
                        المتغيرات الديناميكية المدعومة:
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-right mt-1">
                        <div><code>{`{customer_name}`}</code> - اسم العميل</div>
                        <div><code>{`{order_id}`}</code> - رقم الطلب المرجعي</div>
                        <div><code>{`{order_total}`}</code> - إجمالي قيمة الفاتورة</div>
                        <div><code>{`{currency}`}</code> - العملة الخاصة بالمتجر</div>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <button 
                    onClick={() => handleSaveConfig(false)}
                    disabled={savingConfig}
                    className="btn-primary py-3.5 px-6 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 self-start cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>حفظ إعدادات وقوالب ووكومرس</span>
                  </button>
                </>
              )}

            </div>
          </div>

          {/* Right Instruction panel */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Download plugin Card */}
            <div className="glass-card flex flex-col gap-4 bg-gradient-to-b from-[#0e1622]/90 to-[#070c14]/90 border-[rgba(255,255,255,0.05)]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 flex-row-reverse justify-end">
                <Download className="w-4 h-4 text-[#00ffa7]" />
                <span>إضافة ووردبريس المخصصة</span>
              </h3>
              <p className="text-[10px] text-[#90a4ae] leading-relaxed">
                قم بتنزيل الإضافة الرسمية لـ ConvoBest وتثبيتها في موقع ووردبريس الخاص بك لربط متجرك بالمنصة بشكل آمن وتلقائي.
              </p>
              
              <a 
                href="/downloads/convobest-woocommerce.zip"
                download
                className="btn-secondary py-3 text-xs font-bold text-center flex items-center justify-center gap-2 rounded-xl hover:bg-[#00ffa7]/5 hover:border-[#00ffa7]/20 hover:text-white transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#00ffa7]" />
                <span>تنزيل الإضافة (ZIP)</span>
              </a>
            </div>

            {/* Instruction Steps */}
            <div className="glass-card flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white border-b border-[rgba(255,255,255,0.04)] pb-2">خطوات التفعيل والربط:</h3>
              <ol className="text-[10.5px] text-[#90a4ae] leading-relaxed flex flex-col gap-3 list-decimal list-inside pr-1">
                <li>
                  <strong className="text-white">تنزيل الإضافة</strong>: قم بتنزيل ملف الإضافة المضغوط من الرابط أعلاه.
                </li>
                <li>
                  <strong className="text-white">التثبيت في ووردبريس</strong>: اذهب للوحة تحكم ووردبريس الخاص بمتجرك ◀ إضافات ◀ أضف جديد ◀ رفع إضافة، ثم اختر الملف المرفوع وقم بتفعيله.
                </li>
                <li>
                  <strong className="text-white">تهيئة الربط</strong>: اذهب إلى <code>WooCommerce</code> ◀ <code>إعدادات</code> ◀ اضغط على تبويب <code>ConvoBest WhatsApp</code> الجديد.
                </li>
                <li>
                  <strong className="text-white">تعبئة الخانات</strong>: انسخ <span className="text-[#00ffa7]">رابط الويب هوك</span> و <span className="text-[#00ffa7]">مفتاح الربط</span> من هنا وضعهما هناك.
                </li>
                <li>
                  <strong className="text-white">تأكيد التشغيل</strong>: احفظ التغييرات في ووردبريس، وتأكد من تفعيل زر تشغيل الحالة في لوحة التحكم هذه، ثم جرب إجراء طلب وهمي بمتجرك!
                </li>
              </ol>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
