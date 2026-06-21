'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Smartphone, 
  LogOut, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  X,
  Loader2,
  Send
} from 'lucide-react';

interface WhatsAppInstance {
  id: string;
  name: string;
  token: string;
  status: string;
  createdAt: string;
}

interface UserSession {
  userId: string;
  email: string;
  name?: string;
  role: string;
  subscription?: {
    plan: string;
    status: string;
    startDate: string;
    endDate: string;
  };
}

export default function InstancesPage() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [session, setSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create Instance States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // QR Modal States
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [qrData, setQrData] = useState<{ Qrcode: string; Code: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [qrError, setQrError] = useState('');
  const [isConnectedSuccessfully, setIsConnectedSuccessfully] = useState(false);

  // Toggle visible tokens
  const [visibleTokens, setVisibleTokens] = useState<{ [id: string]: boolean }>({});
  
  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delete / Logout Confirmation States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [instanceToDelete, setInstanceToDelete] = useState<WhatsAppInstance | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [instanceToLogout, setInstanceToLogout] = useState<WhatsAppInstance | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Send Test Message States
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [selectedTestInstance, setSelectedTestInstance] = useState<WhatsAppInstance | null>(null);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('رسالة تجريبية من المنصة لتأكيد اتصال الواتساب بنجاح! 🚀');
  const [sendingTest, setSendingTest] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testError, setTestError] = useState('');

  // Polling ref
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch Instances and Session Data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      // 1. Fetch Session
      const sessionRes = await fetch('/api/auth/session');
      const sessionJson = await sessionRes.json();
      if (sessionRes.ok && sessionJson.authenticated) {
        setSession(sessionJson.user);
      }

      // 2. Fetch Instances
      const instancesRes = await fetch('/api/instances');
      const instancesJson = await instancesRes.json();
      if (!instancesRes.ok) {
        throw new Error(instancesJson.error || 'فشل تحميل قائمة الأرقام.');
      }
      setInstances(instancesJson);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Token Copy
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Toggle Token Visibility
  const toggleTokenVisibility = (id: string) => {
    setVisibleTokens(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Create Instance
  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setCreating(true);
      setCreateError('');

      const res = await fetch('/api/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'فشل إنشاء الرقم الجديد.');
      }

      setNewName('');
      setCreateModalOpen(false);
      // Refresh list
      fetchData();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  // Delete Instance
  const handleDeleteInstance = async () => {
    if (!instanceToDelete) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/instances?id=${instanceToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حذف رقم الواتساب.');
      }
      setDeleteConfirmOpen(false);
      setInstanceToDelete(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Logout Instance
  const handleLogoutInstance = async () => {
    if (!instanceToLogout) return;
    try {
      setLoggingOut(true);
      const res = await fetch(`/api/instances/${instanceToLogout.id}/logout`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تسجيل الخروج وفصل الرقم.');
      }
      setLogoutConfirmOpen(false);
      setInstanceToLogout(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoggingOut(false);
    }
  };
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTestInstance || !testPhone.trim() || !testMessage.trim()) return;

    try {
      setSendingTest(true);
      setTestError('');
      setTestSuccess(false);

      const res = await fetch(`/api/instances/${selectedTestInstance.id}/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: testPhone, text: testMessage }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'فشل إرسال الرسالة التجريبية.');
      }

      setTestSuccess(true);
      setTimeout(() => {
        setTestModalOpen(false);
        setSelectedTestInstance(null);
        setTestPhone('');
        setTestSuccess(false);
      }, 2000);
    } catch (err: any) {
      setTestError(err.message);
    } finally {
      setSendingTest(false);
    }
  };

  // Start QR Code Flow
  const startQrFlow = async (instance: WhatsAppInstance) => {
    setSelectedInstance(instance);
    setQrModalOpen(true);
    setQrData(null);
    setQrError('');
    setIsConnectedSuccessfully(false);
    setLoadingQr(true);

    try {
      const res = await fetch(`/api/instances/${instance.id}/qr`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'فشل توليد رمز QR. تأكد من أن الجلسة غير متصلة بالفعل.');
      }

      if (data.status === 'CONNECTED' || data.alreadyConnected) {
        setIsConnectedSuccessfully(true);
        setLoadingQr(false);
        setTimeout(() => {
          setQrModalOpen(false);
          setSelectedInstance(null);
          setQrData(null);
          fetchData();
        }, 1200);
        return;
      }

      setQrData(data);
      setLoadingQr(false);

      // Start Polling for connection status
      startStatusPolling(instance.id);
    } catch (err: any) {
      setQrError(err.message);
      setLoadingQr(false);
    }
  };

  // Polling Connection Status
  const startStatusPolling = (instanceId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/instances/${instanceId}/status`);
        const data = await res.json();

        if (res.ok) {
          if (data.status === 'CONNECTED') {
            // Connection success!
            setIsConnectedSuccessfully(true);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            // Refresh list after 2 seconds and close modal
            setTimeout(() => {
              setQrModalOpen(false);
              setSelectedInstance(null);
              setQrData(null);
              fetchData();
            }, 2000);
          } else if (data.error) {
            // Connection error / Conflict detected!
            setQrError(data.error);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
          }
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    }, 3000);
  };

  // Regenerate QR
  const handleRegenerateQr = () => {
    if (selectedInstance) {
      startQrFlow(selectedInstance);
    }
  };

  // Close QR Modal and stop polling
  const closeQrModal = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    setQrModalOpen(false);
    setSelectedInstance(null);
    setQrData(null);
    setQrError('');
  };

  useEffect(() => {
    // Cleanup polling on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Compute subscription details
  const getSubscriptionLimits = () => {
    if (!session || !session.subscription) {
      return { plan: 'تجربة مجانية', active: instances.length, limit: 1 };
    }
    const plan = session.subscription.plan;
    let limit = 1;
    if (plan.toLowerCase().includes('starter')) limit = 1;
    else if (plan.toLowerCase().includes('pro')) limit = 3;
    else if (plan.toLowerCase().includes('enterprise')) limit = 10;

    return { plan, active: instances.length, limit };
  };

  const limits = getSubscriptionLimits();

  return (
    <>
      <div className="flex flex-col gap-8 text-right animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">إدارة أرقام الواتساب</h1>
          <p className="text-xs text-[#90a4ae] mt-1">
            اربط أرقام الواتساب الخاصة بك بالمنصة لإرسال الرسائل تلقائياً وتفعيل البوتات الذكية.
          </p>
        </div>
        <button
          onClick={() => {
            setCreateError('');
            setCreateModalOpen(true);
          }}
          className="btn-primary py-3 px-6 text-xs font-bold self-start md:self-auto"
        >
          <span>ربط رقم جديد</span>
          <Plus className="w-4 h-4 ml-1" />
        </button>
      </div>

      {/* Subscription limits banner */}
      <div className="glass-card py-4 px-6 flex items-center justify-between border-l-4 border-l-[#00ffa7] bg-[#00ffa7]/5">
        <div className="flex items-center gap-3">
          <Smartphone className="w-5 h-5 text-[#00ffa7]" />
          <div className="text-xs">
            <span className="text-[#90a4ae] ml-2">خطة الاشتراك الحالية:</span>
            <span className="text-white font-bold">{limits.plan}</span>
          </div>
        </div>
        <div className="text-xs font-bold text-white bg-[#0e1622] px-4 py-1.5 rounded-xl border border-[rgba(255,255,255,0.06)]">
          <span>{limits.active}</span>
          <span className="text-[#607d8b] mx-1">/</span>
          <span className="text-[#90a4ae]">{limits.limit} رقم واتساب نشط</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map((n) => (
            <div key={n} className="glass-card h-64 flex flex-col justify-between animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.03]"></div>
                  <div className="flex flex-col gap-2">
                    <div className="h-4 w-28 bg-white/[0.04] rounded"></div>
                    <div className="h-3 w-16 bg-white/[0.03] rounded"></div>
                  </div>
                </div>
                <div className="w-16 h-6 bg-white/[0.04] rounded-full"></div>
              </div>
              <div className="flex flex-col gap-3 py-4 border-y border-white/[0.03]">
                <div className="h-8 bg-white/[0.02] rounded w-full"></div>
                <div className="h-8 bg-white/[0.02] rounded w-full"></div>
              </div>
              <div className="h-10 bg-white/[0.04] rounded-lg"></div>
            </div>
          ))}
        </div>
      ) : instances.length === 0 ? (
        /* Empty State */
        <div className="glass-card flex flex-col items-center justify-center text-center py-20 px-6 gap-6">
          <div className="w-20 h-20 rounded-3xl bg-[#00ffa7]/10 flex items-center justify-center border border-[#00ffa7]/20 text-[#00ffa7] animate-float">
            <Smartphone className="w-10 h-10 text-glow-primary" />
          </div>
          <div className="flex flex-col gap-1 max-w-md">
            <h3 className="text-lg font-bold text-white">لا يوجد أرقام مرتبطة حالياً</h3>
            <p className="text-xs text-[#90a4ae] leading-relaxed">
              ابدأ بربط أول رقم هاتف واتساب لك الآن لتتمكن من استخدام ميزات المنصة كالإرسال التلقائي وبوت الرد الآلي.
            </p>
          </div>
          <button
            onClick={() => {
              setCreateError('');
              setCreateModalOpen(true);
            }}
            className="btn-primary py-3 px-6 text-xs font-bold"
          >
            <span>اربط رقمك الأول الآن</span>
            <Plus className="w-4 h-4 ml-1" />
          </button>
        </div>
      ) : (
        /* Grid list of instances */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {instances.map((instance) => {
            const isTokenVisible = visibleTokens[instance.id] || false;
            const isCopied = copiedId === instance.id;

            return (
              <div key={instance.id} className="glass-card flex flex-col justify-between gap-6 relative overflow-hidden">
                {/* Background glow if connected */}
                {instance.status === 'CONNECTED' && (
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#00ffa7]/5 rounded-full blur-2xl pointer-events-none"></div>
                )}

                {/* Instance Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-[#90a4ae]">
                      <Smartphone className={`w-5 h-5 ${instance.status === 'CONNECTED' ? 'text-[#00ffa7]' : 'text-[#90a4ae]'}`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{instance.name}</h4>
                      <span className="text-[10px] text-[#607d8b] block mt-0.5" suppressHydrationWarning>
                        تم الإنشاء: {new Date(instance.createdAt).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 border ${
                    instance.status === 'CONNECTED'
                      ? 'bg-[#00ffa7]/10 text-[#00ffa7] border-[#00ffa7]/20'
                      : 'bg-white/[0.02] text-[#90a4ae] border-white/[0.05]'
                  }`}>
                    {instance.status === 'CONNECTED' ? (
                      <>
                        <span>متصل</span>
                        <span className="indicator-online"></span>
                      </>
                    ) : (
                      <>
                        <span>غير متصل</span>
                        <span className="w-2 h-2 rounded-full bg-[#90a4ae] inline-block"></span>
                      </>
                    )}
                  </span>
                </div>

                {/* Instance Credentials Area */}
                <div className="flex flex-col gap-2.5 py-4 border-y border-white/[0.04] text-xs">
                  {/* Instance ID */}
                  <div className="flex items-center justify-between gap-4 bg-white/[0.01] hover:bg-white/[0.02] border border-white/[0.03] p-2 rounded-lg">
                    <span className="text-[#607d8b] font-semibold">Instance ID:</span>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-[#90a4ae] overflow-hidden">
                      <span className="truncate max-w-[150px] sm:max-w-[200px]" title={instance.id}>
                        {instance.id}
                      </span>
                      <button 
                        onClick={() => copyToClipboard(instance.id, instance.id)}
                        className="text-[#607d8b] hover:text-white p-1 rounded transition-colors"
                        title="نسخ المعرف"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-[#00ffa7]" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Token */}
                  <div className="flex items-center justify-between gap-4 bg-white/[0.01] hover:bg-white/[0.02] border border-white/[0.03] p-2 rounded-lg">
                    <span className="text-[#607d8b] font-semibold">توكن المفتاح:</span>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-[#90a4ae]">
                      <span className="tracking-widest">
                        {isTokenVisible ? instance.token : '••••••••••••••••'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => toggleTokenVisibility(instance.id)}
                          className="text-[#607d8b] hover:text-white p-1 rounded"
                          title={isTokenVisible ? 'إخفاء التوكن' : 'إظهار التوكن'}
                        >
                          {isTokenVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                          onClick={() => copyToClipboard(instance.token, instance.id + '-token')}
                          className="text-[#607d8b] hover:text-white p-1 rounded"
                          title="نسخ التوكن"
                        >
                          {copiedId === instance.id + '-token' ? (
                            <Check className="w-3.5 h-3.5 text-[#00ffa7]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Instance Footer Actions */}
                <div className="flex items-center gap-3">
                  {instance.status === 'CONNECTED' ? (
                    <>
                      <button
                        onClick={() => {
                          setSelectedTestInstance(instance);
                          setTestPhone('');
                          setTestError('');
                          setTestSuccess(false);
                          setTestModalOpen(true);
                        }}
                        className="btn-primary py-2.5 px-4 text-xs font-bold flex-1 justify-center bg-gradient-to-tr from-[#00ffa7] to-[#00b0ff] text-black hover:opacity-90 transition-all cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 ml-1" />
                        <span>إرسال تجربة</span>
                      </button>
                      <button
                        onClick={() => {
                          setInstanceToLogout(instance);
                          setLogoutConfirmOpen(true);
                        }}
                        className="btn-secondary py-2.5 px-3 text-xs font-bold border-red-500/20 text-red-400 hover:bg-red-500/5 hover:border-red-500/30 transition-all cursor-pointer"
                        title="قطع اتصال الرقم"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => startQrFlow(instance)}
                      className="btn-primary py-2.5 px-4 text-xs font-bold flex-1 justify-center"
                    >
                      <RefreshCw className="w-3.5 h-3.5 ml-1" />
                      <span>مسح رمز QR</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setInstanceToDelete(instance);
                      setDeleteConfirmOpen(true);
                    }}
                    className="p-2.5 rounded-lg border border-white/[0.05] hover:border-red-500/30 text-[#607d8b] hover:text-red-500 hover:bg-red-500/5 transition-all cursor-pointer"
                    title="حذف الرقم بالكامل"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>

      {/* --- MODAL: CREATE INSTANCE --- */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md border-[rgba(255,255,255,0.08)] bg-[#0e1622] flex flex-col gap-6 text-right animate-fade-in relative">
            <button 
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-4 left-4 text-[#607d8b] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div>
              <h3 className="text-lg font-bold text-white">ربط رقم هاتف جديد</h3>
              <p className="text-xs text-[#90a4ae] mt-1">
                أدخل اسماً توضيحياً للرقم لتتمكن من تمييزه داخل المنصة لاحقاً.
              </p>
            </div>

            <hr className="border-white/[0.04]" />

            {createError && (
              <div className="p-3.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateInstance} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-[#90a4ae] font-bold">اسم الحساب المرجعي</label>
                <input 
                  type="text" 
                  className="input-premium py-3"
                  placeholder="مثال: خدمة العملاء، رقم المبيعات..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn-secondary py-2.5 text-xs font-bold"
                  disabled={creating}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2.5 text-xs font-bold"
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />
                      <span>جاري تهيئة الحساب...</span>
                    </>
                  ) : (
                    <span>تهيئة الحساب والربط</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: QR CODE SCANNER --- */}
      {qrModalOpen && selectedInstance && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg border-[rgba(255,255,255,0.08)] bg-[#0e1622] flex flex-col gap-6 text-right animate-fade-in relative">
            <button 
              onClick={closeQrModal}
              className="absolute top-4 left-4 text-[#607d8b] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[9px] text-[#00ffa7] bg-[#00ffa7]/10 px-2 py-0.5 rounded font-black mb-1.5 inline-block">
                جاري الربط مع: {selectedInstance.name}
              </span>
              <h3 className="text-lg font-bold text-white">امسح رمز الـ QR للاتصال</h3>
              <p className="text-xs text-[#90a4ae] mt-1">
                اتبع الخطوات الموضحة بالأسفل لتوصيل حساب واتساب الخاص بك.
              </p>
            </div>

            <hr className="border-white/[0.04]" />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Steps (RTL Right side or top) */}
              <div className="md:col-span-6 flex flex-col gap-4 text-right">
                <h4 className="text-xs font-bold text-white">خطوات ربط الهاتف:</h4>
                <ol className="flex flex-col gap-3 text-xs text-[#90a4ae] list-decimal pr-4">
                  <li>افتح تطبيق <strong className="text-white font-bold">واتساب</strong> على هاتفك المحمول.</li>
                  <li>اضغط على الإعدادات أو زر القائمة (النقاط الثلاث) ثم اختر <strong className="text-white font-bold">الأجهزة المرتبطة</strong>.</li>
                  <li>اضغط على <strong className="text-white font-bold">ربط جهاز</strong> ووجه الكاميرا نحو الرمز المقابل.</li>
                </ol>
                <div className="p-3 bg-white/[0.02] border border-white/[0.04] rounded-lg mt-2">
                  <p className="text-[10px] text-[#607d8b] leading-relaxed">
                    * يتم الاتصال بشكل فوري بعد إتمام مسح الرمز. لا تقم بإغلاق هذه الصفحة حتى يتم إخبارك بنجاح العملية.
                  </p>
                </div>
              </div>

              {/* QR Image Box (LTL Left side or bottom) */}
              <div className="md:col-span-6 flex flex-col items-center justify-center min-h-[260px] bg-white/[0.01] border border-white/[0.03] rounded-xl p-4">
                {loadingQr ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-[#00ffa7] animate-spin" />
                    <span className="text-xs text-[#90a4ae]">جاري توليد الرمز...</span>
                  </div>
                ) : qrError ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                    <p className="text-xs text-red-500 font-bold max-w-[200px]">{qrError}</p>
                    <button 
                      onClick={handleRegenerateQr}
                      className="btn-secondary py-1.5 px-4 text-[10px] flex items-center gap-1.5 mt-2"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>محاولة أخرى</span>
                    </button>
                  </div>
                ) : isConnectedSuccessfully ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#00ffa7]/15 flex items-center justify-center border border-[#00ffa7]/30 text-[#00ffa7] scale-up animate-pulse">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <span className="text-sm font-bold text-[#00ffa7] mt-2">تم الربط بنجاح!</span>
                    <span className="text-[10px] text-[#90a4ae]">جاري تحديث الجلسة...</span>
                  </div>
                ) : qrData ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="bg-white p-2.5 rounded-xl shadow-lg shadow-black/30">
                      <img 
                        src={qrData.Qrcode} 
                        alt="WhatsApp QR Code" 
                        className="w-44 h-44 object-contain"
                      />
                    </div>

                    <span className="text-[10px] text-[#607d8b] animate-pulse flex items-center gap-1.5 mt-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>جاري فحص حالة مسح الكود...</span>
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <hr className="border-white/[0.04]" />

            <div className="flex items-center justify-between">
              <button
                onClick={handleRegenerateQr}
                className="text-xs text-[#00ffa7] hover:underline flex items-center gap-1 cursor-pointer"
                disabled={loadingQr || isConnectedSuccessfully}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingQr ? 'animate-spin' : ''}`} />
                <span>إعادة توليد الرمز</span>
              </button>

              <button
                onClick={closeQrModal}
                className="btn-secondary py-2 px-6 text-xs font-bold"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRMATION MODAL: DELETE INSTANCE --- */}
      {deleteConfirmOpen && instanceToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md border-red-500/20 bg-[#0e1622] flex flex-col gap-6 text-right animate-fade-in relative">
            <div>
              <h3 className="text-lg font-bold text-red-500 flex items-center gap-2 justify-end">
                <span>تأكيد حذف الحساب</span>
                <Trash2 className="w-5 h-5" />
              </h3>
              <p className="text-xs text-[#90a4ae] mt-2 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف الحساب <strong className="text-white font-bold">{instanceToDelete.name}</strong>؟ 
                سيؤدي هذا الإجراء إلى حذف الجلسة بالكامل من خادم الواتساب، وإلغاء اتصال الرقم، وحذف كافة سجلات الرسائل الخاصة به نهائياً.
              </p>
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setInstanceToDelete(null);
                }}
                className="btn-secondary py-2.5 text-xs font-bold"
                disabled={deleting}
              >
                إلغاء
              </button>
              <button
                onClick={handleDeleteInstance}
                className="btn-primary py-2.5 text-xs font-bold bg-gradient-to-tr from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-red-900/20"
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />
                    <span>جاري حذف الرقم...</span>
                  </>
                ) : (
                  <span>نعم، حذف الحساب</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRMATION MODAL: LOGOUT INSTANCE --- */}
      {logoutConfirmOpen && instanceToLogout && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md border-orange-500/20 bg-[#0e1622] flex flex-col gap-6 text-right animate-fade-in relative">
            <div>
              <h3 className="text-lg font-bold text-orange-500 flex items-center gap-2 justify-end">
                <span>تأكيد قطع الاتصال</span>
                <LogOut className="w-5 h-5" />
              </h3>
              <p className="text-xs text-[#90a4ae] mt-2 leading-relaxed">
                هل أنت متأكد من رغبتك في تسجيل الخروج وفصل الرقم <strong className="text-white font-bold">{instanceToLogout.name}</strong>؟
                سيتم فصل الاتصال بالواتساب فوراً وسيتوجب عليك مسح رمز الـ QR مجدداً لإعادة ربطه.
              </p>
            </div>

            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => {
                  setLogoutConfirmOpen(false);
                  setInstanceToLogout(null);
                }}
                className="btn-secondary py-2.5 text-xs font-bold"
                disabled={loggingOut}
              >
                إلغاء
              </button>
              <button
                onClick={handleLogoutInstance}
                className="btn-primary py-2.5 text-xs font-bold bg-gradient-to-tr from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white shadow-orange-900/20"
                disabled={loggingOut}
              >
                {loggingOut ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />
                    <span>جاري فصل الاتصال...</span>
                  </>
                ) : (
                  <span>نعم، تسجيل الخروج</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* --- MODAL: SEND TEST MESSAGE --- */}
      {testModalOpen && selectedTestInstance && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-md border-[rgba(255,255,255,0.08)] bg-[#0e1622] flex flex-col gap-6 text-right animate-fade-in relative">
            <button 
              onClick={() => {
                setTestModalOpen(false);
                setSelectedTestInstance(null);
              }}
              className="absolute top-4 left-4 text-[#607d8b] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div>
              <span className="text-[9px] text-[#00ffa7] bg-[#00ffa7]/10 px-2 py-0.5 rounded font-black mb-1.5 inline-block">
                رقم الإرسال: {selectedTestInstance.name}
              </span>
              <h3 className="text-lg font-bold text-white">إرسال رسالة تجريبية</h3>
              <p className="text-xs text-[#90a4ae] mt-1">
                اختبر جودة إرسال الرسائل عبر رقم الواتساب المرتبط حالياً.
              </p>
            </div>

            <hr className="border-white/[0.04]" />

            {testError && (
              <div className="p-3.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{testError}</span>
              </div>
            )}

            {testSuccess && (
              <div className="p-3.5 rounded-lg bg-[#00ffa7]/10 border border-[#00ffa7]/20 text-[#00ffa7] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>تم إرسال الرسالة بنجاح! تحقق من الهاتف المستلم.</span>
              </div>
            )}

            <form onSubmit={handleSendTestMessage} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-[#90a4ae] font-bold">رقم الهاتف المستلم (بالصيغة الدولية)</label>
                <input 
                  type="text" 
                  className="input-premium py-3"
                  placeholder="مثال: 201012345678"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  required
                  autoFocus
                />
                <span className="text-[10px] text-[#607d8b]">
                  * يرجى كتابة كود الدولة متبوعاً بالرقم بدون علامة + (مثال: 20 للرمز المصري).
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-[#90a4ae] font-bold">محتوى الرسالة التجريبية</label>
                <textarea 
                  className="input-premium py-3 min-h-[80px] text-xs"
                  placeholder="أكتب نص الرسالة..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  required
                />
              </div>

              <div className="flex items-center gap-3 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTestModalOpen(false);
                    setSelectedTestInstance(null);
                  }}
                  className="btn-secondary py-2.5 text-xs font-bold"
                  disabled={sendingTest}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-primary py-2.5 text-xs font-bold"
                  disabled={sendingTest || testSuccess}
                >
                  {sendingTest ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />
                      <span>جاري الإرسال...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 ml-1" />
                      <span>إرسال الآن</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
