'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Plus, 
  Play, 
  Pause, 
  Trash2, 
  Layers, 
  AlertTriangle, 
  Check, 
  Activity, 
  FileText, 
  Paperclip,
  ImageIcon,
  Video,
  FileUp,
  X, 
  CheckCircle2,
  HelpCircle,
  Clock
} from 'lucide-react';
import Link from 'next/link';

type CampaignAttachment = {
  url: string;
  type: 'image' | 'video' | 'document';
  name: string;
  mime: string;
  size: number;
};

const CAMPAIGN_ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
const CAMPAIGN_ATTACHMENT_ACCEPT = [
  'image/*',
  'video/*',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
].join(',');

function getCampaignAttachmentType(file: File): CampaignAttachment['type'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'document';
}

function formatAttachmentSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export default function CampaignsPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create Campaign Form States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [recipientText, setRecipientText] = useState('');
  const [attachment, setAttachment] = useState<CampaignAttachment | null>(null);
  const [delayMin, setDelayMin] = useState(5);
  const [delayMax, setDelayMax] = useState(15);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  // Confirmation/Actions state
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch data
  async function fetchData() {
    try {
      const sessionRes = await fetch('/api/auth/session', { cache: 'no-store' });
      const sessionData = await sessionRes.json();
      if (sessionRes.ok && sessionData.authenticated) {
        setSession(sessionData.user);
      }

      // Fetch instances
      const instRes = await fetch('/api/instances');
      const instData = await instRes.json();
      if (instRes.ok) {
        const connectedOnly = instData.filter((inst: any) => inst.status === 'CONNECTED');
        setInstances(connectedOnly);
        if (connectedOnly.length > 0 && !selectedInstanceId) {
          setSelectedInstanceId(connectedOnly[0].id);
        }
      }

      // Fetch campaigns
      const campRes = await fetch('/api/campaigns');
      const campData = await campRes.json();
      if (campRes.ok) {
        setCampaigns(campData.campaigns);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();

    // Poll campaign list every 5 seconds to show progress updates in real time
    const interval = setInterval(() => {
      fetch('/api/campaigns')
        .then(res => res.json())
        .then(data => {
          if (data.campaigns) setCampaigns(data.campaigns);
        })
        .catch(err => console.error(err));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const showSuccessMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  const resetCreateCampaignForm = () => {
    setName('');
    setMessageTemplate('');
    setRecipientText('');
    setAttachment(null);
    setDelayMin(5);
    setDelayMax(15);
  };

  const handleCampaignAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setCreateError('');

    if (!file) return;

    if (file.size > CAMPAIGN_ATTACHMENT_MAX_BYTES) {
      setCreateError('حجم المرفق يجب ألا يتجاوز 20 ميجابايت.');
      return;
    }

    const type = getCampaignAttachmentType(file);
    const reader = new FileReader();

    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      const pureBase64 = dataUrl.split(',')[1] || '';
      if (!pureBase64) {
        setCreateError('فشل تحميل المرفق. جرّب ملفًا آخر.');
        return;
      }

      setAttachment({
        url: pureBase64,
        type,
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size
      });
    };

    reader.onerror = () => {
      setCreateError('فشل تحميل المرفق. جرّب ملفًا آخر.');
    };

    reader.readAsDataURL(file);
  };

  // Submit Create Campaign
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');

    const parsedNumbers = recipientText
      .split('\n')
      .map(num => num.trim())
      .filter(num => num.length > 0);

    if (parsedNumbers.length === 0) {
      setCreateError('يرجى إدخال أرقام هواتف المستلمين (رقم واحد على الأقل في السطر)');
      setCreating(false);
      return;
    }

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          instanceId: selectedInstanceId,
          messageTemplate,
          numbers: parsedNumbers,
          attachment: attachment ? {
            mediaUrl: attachment.url,
            mediaType: attachment.type,
            fileName: attachment.name,
            mime: attachment.mime
          } : null,
          delayMin,
          delayMax
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign');

      showSuccessMsg('تم إنشاء حملة الإرسال بنجاح والبدء في تشغيلها بالخلفية!');
      setCreateModalOpen(false);
      resetCreateCampaignForm();
      fetchData();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Pause / Resume / Delete Actions
  const handleAction = async (campaignId: string, action: 'PAUSE' | 'RESUME' | 'DELETE') => {
    setActionId(campaignId);
    setActionLoading(true);
    setError('');
    
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute campaign action');

      if (action === 'DELETE') {
        showSuccessMsg('تم حذف حملة الإرسال بنجاح.');
      } else {
        showSuccessMsg(`تم تحديث حالة الحملة إلى: ${action === 'PAUSE' ? 'موقوفة مؤقتاً' : 'قيد التشغيل'}`);
      }
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionId(null);
      setActionLoading(false);
    }
  };

  // Compute analytics
  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((acc, c) => acc + c.stats.sent, 0);
  const totalFailed = campaigns.reduce((acc, c) => acc + c.stats.failed, 0);
  const currentPlan = session?.subscription?.plan || 'Starter (Trial)';
  const canUseCampaigns = !currentPlan.toLowerCase().includes('trial');
  const hasActiveCampaign = campaigns.some(c => c.status === 'RUNNING' || c.status === 'PENDING');

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ffa7] to-[#00b0ff] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#060b11] animate-spin" />
          </div>
          <span className="text-xs text-[#90a4ae]">جاري تحميل حملات الإرسال الجماعي...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-8 text-right animate-fade-in relative">
        
        {/* Title and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {instances.length > 0 && canUseCampaigns && (
            <button
              onClick={() => {
                if (hasActiveCampaign) return;
                setCreateError('');
                setCreateModalOpen(true);
              }}
              className={`py-3 px-6 text-xs font-bold self-start sm:self-auto flex items-center gap-1.5 transition-all ${
                hasActiveCampaign
                  ? 'opacity-40 bg-[#162232] text-[#607d8b] cursor-not-allowed border border-[rgba(255,255,255,0.08)] rounded-xl'
                  : 'btn-primary'
              }`}
              title={hasActiveCampaign ? "لا يمكنك إنشاء حملة جديدة أثناء تشغيل حملة أخرى" : "إنشاء حملة إرسال جماعي"}
              disabled={hasActiveCampaign}
            >
              <span>إنشاء حملة إرسال جماعي</span>
              <Plus className="w-4 h-4 ml-1" />
            </button>
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">حملات الإرسال الجماعي (Bulk Messaging)</h1>
            <p className="text-xs text-[#90a4ae] mt-1">ارسل آلاف الرسائل دفعة واحدة عبر أرقامك المربوطة مع تحكم عشوائي بالدلي والـ Anti-Ban للوقاية من الحظر.</p>
          </div>
        </div>

        {/* Global Alerts */}
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

        {hasActiveCampaign && (
          <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs flex items-start gap-2.5 text-right">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-bold text-white">لديك حملة نشطة حالياً قيد التشغيل</span>
              <span>تنص سياسة المنصة على تشغيل حملة واحدة فقط في نفس الوقت لحماية أرقامك من الحظر. يرجى انتظار اكتمال الحملة الحالية أو إيقافها مؤقتاً لتتمكن من إنشاء حملات جديدة أو استئناف غيرها.</span>
            </div>
          </div>
        )}

        {!canUseCampaigns && (
          <div className="glass-card flex flex-col items-center justify-center text-center py-16 px-6 gap-6 border-l-4 border-l-orange-500">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="flex flex-col gap-2 max-w-lg">
              <h3 className="text-lg font-bold text-white">حملات الإرسال غير متاحة في الفترة التجريبية</h3>
              <p className="text-xs text-[#90a4ae] leading-relaxed">
                حسابك الحالي في فترة تجريبية ({currentPlan}) والتي لا تتيح تشغيل الحملات الجماعية. يرجى الترقية إلى أي باقة مدفوعة (Starter أو Pro أو Enterprise) للبدء في استخدام حملات الإرسال الجماعي.
              </p>
            </div>
            <Link href="/dashboard/billing" className="btn-primary text-xs font-bold py-3.5 px-6">
              ترقية الباقة الآن
            </Link>
          </div>
        )}

        {/* Stats Grid widgets */}
        {canUseCampaigns && <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Stat 1 */}
          <div className="glass-card flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-[#00ffa7]/10 flex items-center justify-center border border-[#00ffa7]/20 text-[#00ffa7]">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-[#607d8b] font-semibold">إجمالي حملاتك</span>
              <h3 className="text-2xl font-black text-white mt-1">{totalCampaigns}</h3>
            </div>
          </div>

          {/* Stat 2 */}
          <div className="glass-card flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-[#00b0ff]/10 flex items-center justify-center border border-[#00b0ff]/20 text-[#00b0ff]">
              <Send className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-[#607d8b] font-semibold">الرسائل الناجحة</span>
              <h3 className="text-2xl font-black text-white mt-1">{totalSent}</h3>
            </div>
          </div>

          {/* Stat 3 */}
          <div className="glass-card flex items-center justify-between">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 text-red-500">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-[#607d8b] font-semibold">الرسائل الفاشلة</span>
              <h3 className="text-2xl font-black text-white mt-1">{totalFailed}</h3>
            </div>
          </div>
        </div>}

        {/* Instances Availability checker */}
        {canUseCampaigns && (instances.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center text-center py-16 px-6 gap-6">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-md">
              <h3 className="text-lg font-bold text-white">لم تقم بربط أي رقم هاتف متصل حالياً</h3>
              <p className="text-xs text-[#90a4ae] leading-relaxed">
                لإنشاء حملة إرسال جماعي، يجب أولاً ربط رقم هاتف واتساب واحد على الأقل وتفعيل اتصاله بالمسح الضوئي للـ QR.
              </p>
            </div>
            <Link href="/dashboard/instances" className="btn-primary text-xs font-bold py-3 px-6">
              اذهب لربط رقم واتساب بالمسح الضوئي
            </Link>
          </div>
        ) : (
          /* Campaigns table list */
          <div className="glass-card flex flex-col gap-4 overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.04)] text-[#607d8b] font-bold">
                    <th className="pb-3 text-right">الحملة</th>
                    <th className="pb-3 text-center">الرقم المرسل منه</th>
                    <th className="pb-3 text-center">التأخير (Delay)</th>
                    <th className="pb-3 text-center">تقدم الإرسال</th>
                    <th className="pb-3 text-center">حالة الحملة</th>
                    <th className="pb-3 text-center">تاريخ الإنشاء</th>
                    <th className="pb-3 text-left">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-xs text-[#607d8b] font-semibold">
                        لم تقم بإنشاء أي حملات إرسال جماعي حتى الآن. انقر على الزر بالأعلى للبدء.
                      </td>
                    </tr>
                  ) : (
                    campaigns.map((c, idx) => {
                      const total = c.stats.total;
                      const sent = c.stats.sent;
                      const failed = c.stats.failed;
                      const pending = c.stats.pending;
                      const progress = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;
                      
                      return (
                        <tr 
                          key={idx} 
                          className="border-b border-[rgba(255,255,255,0.03)] text-[#90a4ae] hover:text-white hover:bg-white/[0.01] transition-all"
                        >
                          <td className="py-4">
                            <div className="flex flex-col text-right">
                              <span className="font-bold text-white text-sm">{c.name}</span>
                              <span className="text-[10px] text-[#607d8b] mt-0.5 truncate max-w-[180px]">{c.messageTemplate}</span>
                              {c.attachmentType && (
                                <span className="text-[9px] text-[#00ffa7] mt-1 flex flex-row-reverse items-center gap-1 justify-end">
                                  <Paperclip className="w-3 h-3" />
                                  <span>{c.attachmentName || 'مرفق حملة'}</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 text-center font-semibold text-white">
                            {c.instanceName}
                          </td>
                          <td className="py-4 text-center font-mono">
                            {c.delayMin}-{c.delayMax} ثانية
                          </td>
                          <td className="py-4 text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              <div className="flex items-center gap-1 text-[10px] font-bold text-white">
                                <span>{sent}</span>
                                <span className="text-[#607d8b]">/</span>
                                <span>{total}</span>
                                {failed > 0 && <span className="text-red-500 font-normal">({failed} خطأ)</span>}
                              </div>
                              {/* progress bar */}
                              <div className="w-24 h-1.5 bg-[#162232] rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-[#00ffa7] to-[#00b0ff] transition-all duration-500" 
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              c.status === 'COMPLETED' 
                                ? 'bg-[#00ffa7]/10 text-[#00ffa7]' 
                                : c.status === 'RUNNING'
                                ? 'bg-[#00b0ff]/10 text-[#00b0ff] animate-pulse'
                                : c.status === 'PAUSED'
                                ? 'bg-orange-500/10 text-orange-400'
                                : 'bg-white/[0.04] text-[#90a4ae]'
                            }`}>
                              {c.status === 'COMPLETED' ? 'مكتملة' : c.status === 'RUNNING' ? 'قيد التشغيل' : c.status === 'PAUSED' ? 'موقوفة' : 'معلقة'}
                            </span>
                          </td>
                          <td className="py-4 text-center font-mono text-[10px] text-[#607d8b]" suppressHydrationWarning>
                            {new Date(c.createdAt).toLocaleDateString('ar-EG')}
                          </td>
                          <td className="py-4 text-left">
                            <div className="flex items-center gap-2 justify-start">
                              {c.status === 'RUNNING' && (
                                <button 
                                  onClick={() => handleAction(c.id, 'PAUSE')}
                                  className="p-1.5 rounded-lg bg-[#121620] hover:bg-orange-500/10 border border-[rgba(255,255,255,0.04)] text-[#90a4ae] hover:text-orange-400 transition-all cursor-pointer"
                                  title="إيقاف مؤقت للحملة"
                                  disabled={actionLoading && actionId === c.id}
                                >
                                  <Pause className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {c.status === 'PAUSED' && (
                                <button 
                                  onClick={() => handleAction(c.id, 'RESUME')}
                                  className={`p-1.5 rounded-lg border border-[rgba(255,255,255,0.04)] transition-all ${
                                    hasActiveCampaign
                                      ? 'opacity-40 bg-[#121620] text-[#90a4ae] cursor-not-allowed'
                                      : 'bg-[#121620] hover:bg-[#00ffa7]/10 text-[#90a4ae] hover:text-[#00ffa7] cursor-pointer'
                                  }`}
                                  title={hasActiveCampaign ? "لديك حملة أخرى نشطة قيد التشغيل بالفعل" : "استئناف الإرسال"}
                                  disabled={(actionLoading && actionId === c.id) || hasActiveCampaign}
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button 
                                onClick={() => handleAction(c.id, 'DELETE')}
                                className="p-1.5 rounded-lg bg-[#121620] hover:bg-red-500/10 border border-[rgba(255,255,255,0.04)] text-[#90a4ae] hover:text-red-500 transition-all cursor-pointer"
                                title="حذف الحملة"
                                disabled={actionLoading && actionId === c.id}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* --- CREATE CAMPAIGN MODAL (Fragment level) --- */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCreateModalOpen(false)}
          ></div>
          
          <div className="relative z-10 w-full max-w-lg bg-[#0e1622] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-2xl animate-fade-in text-right">
            
            {/* Header */}
            <div className="bg-[#0c0f16] px-6 py-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.04)]">
              <button 
                onClick={() => setCreateModalOpen(false)}
                className="text-[#607d8b] hover:text-white transition-all bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>إنشاء حملة إرسال جديدة</span>
              </h3>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateCampaign} className="p-6 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
              
              {createError && (
                <div className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4.5 h-4.5 flex-shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-[#90a4ae]">اسم الحملة</label>
                <input 
                  type="text"
                  placeholder="مثال: عروض عيد الأضحى 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-premium text-xs"
                  disabled={creating}
                  required
                />
              </div>

              {/* Instance Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-[#90a4ae]">الرقم المرسل منه</label>
                <select
                  value={selectedInstanceId}
                  onChange={(e) => setSelectedInstanceId(e.target.value)}
                  className="input-premium text-xs pr-4"
                  disabled={creating}
                >
                  {instances.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} - متصل
                    </option>
                  ))}
                </select>
              </div>

              {/* Recipients list textarea */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-[#90a4ae] flex flex-row-reverse items-center gap-1.5 justify-end">
                  <span>
                    أرقام مستلمي الحملة (<span className="inline-block text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.45)] animate-pulse">رقم واحد في كل سطر مع مفتاح الدولة</span>)
                  </span>
                  <FileText className="w-3.5 h-3.5 text-[#ff9100]" />
                </label>
                <textarea 
                  placeholder="201012345678&#10;966512345678"
                  value={recipientText}
                  onChange={(e) => setRecipientText(e.target.value)}
                  className="input-premium text-xs min-h-[110px] leading-relaxed text-right font-mono"
                  style={{ direction: 'ltr' }}
                  disabled={creating}
                  required
                />
                <span className="text-[9px] text-[#90a4ae] self-end mt-0.5 font-semibold">
                  ملاحظة: الحد الأقصى لخطة اشتراكك الحالية ({currentPlan}) هو {currentPlan.toLowerCase().includes('enterprise') ? '10,000' : currentPlan.toLowerCase().includes('pro') ? '2,000' : '350'} جهة اتصال في الحملة الواحدة. سيقوم النظام بتنقية المدخلات تلقائياً من أي مسافات أو رموز غير رقمية.
                </span>
              </div>

              {/* Message Template textarea */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-[#90a4ae]">نص الرسالة</label>
                <textarea 
                  placeholder="مرحباً بك عميلنا العزيز! يسعدنا تقديم عرض خاص..."
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  className="input-premium text-xs min-h-[110px] leading-relaxed"
                  disabled={creating}
                  required
                />
              </div>

              {/* Campaign attachment */}
              <div className="flex flex-col gap-2 rounded-xl border border-[rgba(255,255,255,0.05)] bg-[#0c121c] p-3">
                <div className="flex flex-row-reverse items-center justify-between gap-3">
                  <label className="text-[11px] font-bold text-[#90a4ae] flex flex-row-reverse items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-[#00ffa7]" />
                    <span>مرفقات الحملة</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={creating}
                    className="px-3 py-2 rounded-lg bg-[#162232] hover:bg-[#1d2a3d] border border-[rgba(255,255,255,0.06)] text-[#00ffa7] text-[10px] font-bold transition-all flex flex-row-reverse items-center gap-1.5 disabled:opacity-50"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>إرفاق صورة أو فيديو أو مستند</span>
                  </button>
                </div>

                <input
                  ref={attachmentInputRef}
                  type="file"
                  accept={CAMPAIGN_ATTACHMENT_ACCEPT}
                  onChange={handleCampaignAttachmentChange}
                  className="hidden"
                  disabled={creating}
                />

                {attachment ? (
                  <div className="flex flex-row-reverse items-center justify-between gap-3 rounded-lg border border-[#00ffa7]/15 bg-[#00ffa7]/5 px-3 py-2">
                    <div className="flex flex-row-reverse items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#00ffa7]/10 border border-[#00ffa7]/20 text-[#00ffa7] flex items-center justify-center flex-shrink-0">
                        {attachment.type === 'image' ? <ImageIcon className="w-4 h-4" /> : attachment.type === 'video' ? <Video className="w-4 h-4" /> : <FileUp className="w-4 h-4" />}
                      </div>
                      <div className="flex flex-col min-w-0 text-right">
                        <span className="text-[11px] font-bold text-white truncate">{attachment.name}</span>
                        <span className="text-[9px] text-[#90a4ae]">{attachment.type} · {formatAttachmentSize(attachment.size)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                      disabled={creating}
                      title="إزالة المرفق"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[9px] text-[#607d8b] self-end">يمكنك إرفاق صورة أو فيديو أو مستند مع نص الرسالة.</span>
                )}
              </div>

              {/* Anti-ban Delay range sliders */}
              <div className="grid grid-cols-2 gap-4 bg-[#0c121c] p-4 rounded-xl border border-[rgba(255,255,255,0.03)]">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[#90a4ae] flex items-center gap-1 justify-end">
                    <span>التأخير الأقصى (ثانية)</span>
                    <Clock className="w-3.5 h-3.5 text-[#00ffa7]" />
                  </label>
                  <input 
                    type="number"
                    min={delayMin + 1}
                    max={120}
                    value={delayMax}
                    onChange={(e) => setDelayMax(Number(e.target.value))}
                    className="input-premium text-xs text-center font-bold"
                    disabled={creating}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-[#90a4ae] flex items-center gap-1 justify-end">
                    <span>التأخير الأدنى (ثانية)</span>
                    <Clock className="w-3.5 h-3.5 text-[#ff9100]" />
                  </label>
                  <input 
                    type="number"
                    min={2}
                    max={delayMax - 1}
                    value={delayMin}
                    onChange={(e) => setDelayMin(Number(e.target.value))}
                    className="input-premium text-xs text-center font-bold"
                    disabled={creating}
                    required
                  />
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex gap-3 mt-4">
                <button 
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn-secondary flex-1 py-3 text-xs justify-center font-bold"
                  disabled={creating}
                >
                  إلغاء
                </button>
                <button 
                  type="submit"
                  className="btn-primary flex-1 py-3 text-xs justify-center font-bold"
                  disabled={creating}
                >
                  {creating ? 'جاري جدولة الحملة وبدء الإرسال...' : 'ابدأ تشغيل الحملة الإعلانية'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </>
  );
}
