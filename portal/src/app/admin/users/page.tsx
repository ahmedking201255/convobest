'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  Check,
  Edit2,
  Inbox,
  ListChecks,
  LogOut,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  Smartphone,
  Trash2,
  X
} from 'lucide-react';

type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  createdAt: string;
  instancesCount: number;
  instances: Array<{ id: string; name: string; status: string }>;
  subscription?: {
    id: string;
    plan: string;
    status: string;
    startDate: string;
    endDate: string;
  } | null;
  messagesSent?: number;
  messagesReceived?: number;
  usageLimit?: number;
  usageUsed?: number;
  usageRemaining?: number;
};

const formatDate = (value?: string | Date | null) => {
  if (!value) return 'غير متوفر';
  return new Date(value).toLocaleDateString('ar-EG');
};

const statusText = (status?: string) => {
  if (status === 'CONNECTED') return 'متصل';
  if (status === 'ACTIVE') return 'نشط';
  if (status === 'EXPIRED') return 'منتهي';
  if (status === 'CANCELLED') return 'ملغي';
  return 'غير متصل';
};

export default function AdminUsersManager() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editPlan, setEditPlan] = useState('Starter (Trial)');
  const [editStatus, setEditStatus] = useState('ACTIVE');
  const [editEndDate, setEditEndDate] = useState('');
  const [editRole, setEditRole] = useState('USER');
  const [editName, setEditName] = useState('');
  const [updating, setUpdating] = useState(false);

  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [resettingUser, setResettingUser] = useState<AdminUser | null>(null);
  const [resetting, setResetting] = useState(false);

  const [resourceModal, setResourceModal] = useState<{
    user: AdminUser;
    view: 'usage' | 'inbox' | 'instances' | 'logs';
  } | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceData, setResourceData] = useState<any>(null);
  const [resourceActionId, setResourceActionId] = useState<string | null>(null);

  // Infinite scroll logs states
  const [logs, setLogs] = useState<any[]>([]);
  const [logsSkip, setLogsSkip] = useState(0);
  const [logsTotal, setLogsTotal] = useState(0);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [loadingMoreLogs, setLoadingMoreLogs] = useState(false);

  async function fetchUsers() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch users.');
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;
    return users.filter(user =>
      user.email.toLowerCase().includes(term) ||
      (user.name || '').toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditRole(user.role);
    setEditPlan(user.subscription?.plan || 'Starter (Trial)');
    setEditStatus(user.subscription?.status || 'ACTIVE');
    setEditEndDate(user.subscription?.endDate ? new Date(user.subscription.endDate).toISOString().slice(0, 10) : '');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setUpdating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          name: editName,
          role: editRole,
          subscription: {
            plan: editPlan,
            status: editStatus,
            endDate: editEndDate ? new Date(editEndDate).toISOString() : null
          }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user.');

      setEditingUser(null);
      showSuccess(`تم تحديث بيانات العميل ${editingUser.email} بنجاح.`);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users?userId=${deletingUser.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user.');

      showSuccess(`تم حذف حساب العميل ${deletingUser.email} وكافة بياناته.`);
      setDeletingUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleResetQuota = async () => {
    if (!resettingUser) return;

    setResetting(true);
    try {
      const res = await fetch('/api/admin/users/reset-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: resettingUser.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset quota.');

      showSuccess(`تم إعادة تعيين رصيد الاستهلاك الشهري للعميل ${resettingUser.name || resettingUser.email} بنجاح.`);
      setResettingUser(null);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResetting(false);
    }
  };

  const loadResource = async (user: AdminUser, view: 'usage' | 'inbox' | 'instances' | 'logs') => {
    setResourceModal({ user, view });
    setResourceData(null);
    setResourceLoading(true);

    // Reset logs states
    setLogs([]);
    setLogsSkip(0);
    setLogsTotal(0);
    setHasMoreLogs(false);
    setLoadingMoreLogs(false);

    try {
      const url = view === 'logs'
        ? `/api/admin/users/${user.id}/resources?view=logs&limit=50&skip=0`
        : `/api/admin/users/${user.id}/resources?view=${view}`;

      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load data.');

      if (view === 'logs') {
        const fetchedLogs = data.logs || [];
        setLogs(fetchedLogs);
        setLogsTotal(data.totalCount || 0);
        setLogsSkip(fetchedLogs.length);
        setHasMoreLogs(fetchedLogs.length < (data.totalCount || 0));
        setResourceData({ success: true });
      } else {
        setResourceData(data);
      }
    } catch (err: any) {
      setResourceData({ error: err.message });
    } finally {
      setResourceLoading(false);
    }
  };

  const refreshResource = () => {
    if (!resourceModal) return;
    loadResource(resourceModal.user, resourceModal.view);
  };

  const handleInstanceAction = async (instanceId: string, action: 'DISCONNECT_INSTANCE' | 'DELETE_INSTANCE') => {
    if (!resourceModal) return;
    const confirmMessage = action === 'DELETE_INSTANCE'
      ? 'هل تريد حذف رقم الواتساب نهائيا من حساب العميل؟'
      : 'هل تريد قطع اتصال رقم الواتساب لهذا العميل؟';
    if (!window.confirm(confirmMessage)) return;

    setResourceActionId(instanceId);
    try {
      const res = await fetch(`/api/admin/users/${resourceModal.user.id}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, instanceId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute action.');
      showSuccess(action === 'DELETE_INSTANCE' ? 'تم حذف رقم الواتساب.' : 'تم قطع اتصال رقم الواتساب.');
      refreshResource();
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResourceActionId(null);
    }
  };

  const handleClearLogs = async () => {
    if (!resourceModal) return;
    if (!window.confirm('هل تريد حذف سجل الرسائل لهذا العميل؟ لن يتم حذف رسائل الصندوق الوارد.')) return;

    setResourceActionId('logs');
    try {
      const res = await fetch(`/api/admin/users/${resourceModal.user.id}/resources?target=logs`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear logs.');
      showSuccess(`تم حذف ${data.deletedCount || 0} سجل من سجلات العميل.`);
      
      setLogs([]);
      setLogsTotal(0);
      setLogsSkip(0);
      setHasMoreLogs(false);
      setResourceData({ success: true });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResourceActionId(null);
    }
  };

  const loadMoreLogs = async () => {
    if (!resourceModal || loadingMoreLogs || !hasMoreLogs) return;

    setLoadingMoreLogs(true);
    try {
      const user = resourceModal.user;
      const res = await fetch(
        `/api/admin/users/${user.id}/resources?view=logs&limit=50&skip=${logsSkip}`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load more logs.');

      const newLogs = data.logs || [];
      if (newLogs.length === 0) {
        setHasMoreLogs(false);
      } else {
        setLogs(prev => [...prev, ...newLogs]);
        const nextSkip = logsSkip + newLogs.length;
        setLogsSkip(nextSkip);
        setHasMoreLogs(nextSkip < (data.totalCount || 0));
      }
    } catch (err: any) {
      console.error('Error loading more logs:', err);
    } finally {
      setLoadingMoreLogs(false);
    }
  };

  const handleLogsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 50;
    if (isAtBottom && hasMoreLogs && !loadingMoreLogs && !resourceLoading) {
      loadMoreLogs();
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff9100] to-[#ff3d00] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#060b11] animate-spin" />
          </div>
          <span className="text-xs text-[#90a4ae]">جاري تحميل قائمة العملاء...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-8 text-right animate-fade-in relative">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" dir="rtl">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white">إدارة العملاء والاشتراكات</h1>
            <p className="text-xs text-[#90a4ae] mt-1">عرض وتعديل بيانات العملاء ومتابعة استخدامهم وأرقام واتساب الخاصة بهم.</p>
          </div>
          <div className="flex items-center gap-4 bg-[#121e2a]/40 border border-[rgba(255,255,255,0.04)] px-4 py-2 rounded-xl w-full sm:max-w-md">
            <input
              type="text"
              placeholder="ابحث بالاسم أو البريد الإلكتروني..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none text-white text-xs outline-none flex-1 text-right"
            />
            <Search className="w-4 h-4 text-[#607d8b]" />
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-[#00ffa7]/10 border border-[#00ffa7]/20 text-[#00ffa7] text-xs flex items-center gap-2.5 animate-fade-in">
            <Check className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="glass-card flex flex-col gap-4 overflow-hidden border-[rgba(255,145,0,0.06)]">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.04)] text-[#607d8b] font-bold">
                  <th className="pb-3 text-right">العميل</th>
                  <th className="pb-3 text-center">باقة الاشتراك</th>
                  <th className="pb-3 text-center">الاستهلاك</th>
                  <th className="pb-3 text-center">الحالة</th>
                  <th className="pb-3 text-center">أرقام الواتساب</th>
                  <th className="pb-3 text-center">الصادر</th>
                  <th className="pb-3 text-center">الوارد</th>
                  <th className="pb-3 text-center">تاريخ الانتهاء</th>
                  <th className="pb-3 text-center">تاريخ التسجيل</th>
                  <th className="pb-3 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-xs text-[#607d8b] font-semibold">
                      لا يوجد عملاء يطابقون البحث الحالي.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const hasActiveSub = user.subscription?.status === 'ACTIVE';
                    return (
                      <tr
                        key={user.id}
                        className="border-b border-[rgba(255,255,255,0.03)] text-[#90a4ae] hover:text-white hover:bg-[#ff9100]/[0.01] transition-all"
                      >
                        <td className="py-4">
                          <div className="flex flex-col text-right">
                            <span className="font-bold text-white text-sm">{user.name || 'مستخدم بدون اسم'}</span>
                            <span className="text-[10px] text-[#607d8b] mt-0.5 font-mono">{user.email}</span>
                            {user.role === 'ADMIN' && (
                              <span className="inline-flex self-start items-center gap-1 bg-[#ff9100]/10 text-[#ff9100] text-[8px] font-black px-1.5 py-0.5 rounded-full mt-1.5">
                                <Shield className="w-2 h-2" />
                                مسؤول
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${
                            user.subscription?.plan?.includes('Enterprise')
                              ? 'bg-[#00b0ff]/10 text-[#00b0ff]'
                              : user.subscription?.plan?.includes('Pro')
                                ? 'bg-[#00ffa7]/10 text-[#00ffa7]'
                                : 'bg-[#607d8b]/10 text-[#90a4ae]'
                          }`}>
                            {user.subscription?.plan || 'لا يوجد'}
                          </span>
                        </td>
                        <td className="py-4 text-center">
                          {user.subscription ? (
                            user.usageLimit && user.usageLimit > 0 ? (
                              <div className="flex flex-col items-center">
                                <span className="font-bold text-white text-xs font-mono">
                                  {(user.usageUsed ?? 0).toLocaleString('en-US')} / {(user.usageLimit ?? 0).toLocaleString('en-US')}
                                </span>
                                <span className="text-[9px] text-[#00ffa7]/80 mt-0.5 font-bold">
                                  المتبقي: {(user.usageRemaining ?? 0).toLocaleString('en-US')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#607d8b] font-bold text-[10px]">غير محدود</span>
                            )
                          ) : (
                            <span className="text-[#607d8b] font-bold text-[10px]">-</span>
                          )}
                        </td>
                        <td className="py-4 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            hasActiveSub ? 'bg-[#00ffa7]/10 text-[#00ffa7]' : 'bg-red-500/10 text-red-500'
                          }`}>
                            {hasActiveSub ? 'نشط' : 'منتهي / ملغي'}
                          </span>
                        </td>
                        <td className="py-4 text-center font-bold text-white text-sm">{user.instancesCount}</td>
                        <td className="py-4 text-center font-bold text-[#00ffa7] text-sm font-mono">{user.messagesSent ?? 0}</td>
                        <td className="py-4 text-center font-bold text-[#00b0ff] text-sm font-mono">{user.messagesReceived ?? 0}</td>
                        <td className="py-4 text-center font-mono text-[10px]" suppressHydrationWarning>
                          {formatDate(user.subscription?.endDate)}
                        </td>
                        <td className="py-4 text-center font-mono text-[10px] text-[#607d8b]" suppressHydrationWarning>
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="py-4 text-left">
                          <div className="flex items-center gap-2 justify-start">
                            <button onClick={() => loadResource(user, 'usage')} className="p-2 rounded-lg bg-[#121620] hover:bg-[#00ffa7]/10 border border-[rgba(255,255,255,0.04)] text-[#90a4ae] hover:text-[#00ffa7] transition-all" title="متابعة الإستهلاك">
                              <BarChart3 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => loadResource(user, 'inbox')} className="p-2 rounded-lg bg-[#121620] hover:bg-[#00b0ff]/10 border border-[rgba(255,255,255,0.04)] text-[#90a4ae] hover:text-[#00b0ff] transition-all" title="مشاهدة الصندوق الوارد">
                              <Inbox className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => loadResource(user, 'instances')} className="p-2 rounded-lg bg-[#121620] hover:bg-purple-500/10 border border-[rgba(255,255,255,0.04)] text-[#90a4ae] hover:text-purple-300 transition-all" title="أرقام الواتساب">
                              <Smartphone className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => loadResource(user, 'logs')} className="p-2 rounded-lg bg-[#121620] hover:bg-orange-500/10 border border-[rgba(255,255,255,0.04)] text-[#90a4ae] hover:text-orange-400 transition-all" title="سجلات العميل">
                              <ListChecks className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openEditModal(user)} className="p-2 rounded-lg bg-[#121620] hover:bg-[#ff9100]/10 border border-[rgba(255,255,255,0.04)] text-[#90a4ae] hover:text-[#ff9100] transition-all" title="تعديل الحساب والاشتراك">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setResettingUser(user)} className="p-2 rounded-lg bg-[#121620] hover:bg-yellow-500/10 border border-[rgba(255,255,255,0.04)] text-[#90a4ae] hover:text-yellow-500 transition-all" title="إعادة تعيين رصيد الإرسال الشهري">
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeletingUser(user)} className="p-2 rounded-lg bg-[#121620] hover:bg-red-500/10 border border-[rgba(255,255,255,0.04)] text-[#90a4ae] hover:text-red-500 transition-all" title="حذف المستخدم نهائيا">
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
      </div>

      {resourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResourceModal(null)} />
          <div className={`relative z-10 w-full ${resourceModal.view === 'inbox' ? 'max-w-6xl' : 'max-w-4xl'} bg-[#0e1622] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-2xl animate-fade-in text-right`}>
            <div className="bg-[#0c0f16] px-6 py-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.04)]">
              <div className="flex items-center gap-2">
                <button onClick={() => setResourceModal(null)} className="text-[#607d8b] hover:text-white transition-all bg-transparent">
                  <X className="w-5 h-5" />
                </button>
                <button onClick={refreshResource} className="text-[#607d8b] hover:text-[#00ffa7] transition-all bg-transparent" title="تحديث">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-sm font-bold text-white">
                {resourceModal.view === 'usage' && 'متابعة الإستهلاك'}
                {resourceModal.view === 'inbox' && 'الصندوق الوارد للعميل'}
                {resourceModal.view === 'instances' && 'أرقام الواتساب'}
                {resourceModal.view === 'logs' && 'سجلات العميل'}
                <span className="text-[#607d8b] font-normal"> - {resourceModal.user.email}</span>
              </h3>
            </div>
            <div 
              className={resourceModal.view === 'inbox' ? 'p-0' : 'p-6 max-h-[75vh] overflow-y-auto'}
              onScroll={resourceModal.view === 'logs' ? handleLogsScroll : undefined}
            >
              {resourceLoading ? (
                <div className="py-16 flex flex-col items-center gap-3 animate-pulse text-[#90a4ae] text-xs">
                  <Activity className="w-6 h-6 animate-spin text-[#00ffa7]" />
                  جاري تحميل البيانات...
                </div>
              ) : resourceData?.error ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs">{resourceData.error}</div>
              ) : (
                <ResourceContent
                  view={resourceModal.view}
                  data={resourceModal.view === 'logs' ? { logs, totalCount: logsTotal } : resourceData}
                  actionId={resourceActionId}
                  onInstanceAction={handleInstanceAction}
                  onClearLogs={handleClearLogs}
                  loadingMoreLogs={loadingMoreLogs}
                  hasMoreLogs={hasMoreLogs}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingUser(null)} />
          <div className="relative z-10 w-full max-w-md bg-[#0e1622] border border-[rgba(255,145,0,0.15)] rounded-2xl overflow-hidden shadow-2xl animate-fade-in text-right">
            <div className="bg-[#0c0f16] px-6 py-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.04)]">
              <button onClick={() => setEditingUser(null)} className="text-[#607d8b] hover:text-white transition-all bg-transparent">
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-sm font-bold text-white">تعديل اشتراك العميل</h3>
            </div>
            <form onSubmit={handleUpdateUser} className="p-6 flex flex-col gap-5">
              <div className="bg-[#060b11]/80 rounded-xl p-4 border border-[rgba(255,255,255,0.03)] flex flex-col text-right">
                <span className="text-[10px] text-[#607d8b] font-semibold">العميل</span>
                <span className="text-xs font-bold text-white mt-0.5">{editingUser.name || 'مستخدم بدون اسم'}</span>
                <span className="text-[10px] text-[#90a4ae] mt-1 font-mono">{editingUser.email}</span>
              </div>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#90a4ae]">
                اسم العميل
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="input-premium text-xs" />
              </label>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#90a4ae]">
                صلاحية الحساب
                <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="input-premium text-xs">
                  <option value="USER">عميل عادي (USER)</option>
                  <option value="ADMIN">مسؤول نظام (ADMIN)</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#90a4ae]">
                  خطة الاشتراك
                  <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)} className="input-premium text-xs">
                    <option value="Starter">Starter</option>
                    <option value="Pro">Pro</option>
                    <option value="Enterprise">Enterprise</option>
                    <option value="Starter (Trial)">Starter (Trial)</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#90a4ae]">
                  حالة الاشتراك
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="input-premium text-xs">
                    <option value="ACTIVE">نشط (ACTIVE)</option>
                    <option value="EXPIRED">منتهي (EXPIRED)</option>
                    <option value="CANCELLED">ملغي (CANCELLED)</option>
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-[#90a4ae]">
                <span className="flex items-center gap-1 self-end"><Calendar className="w-3.5 h-3.5 text-[#ff9100]" /> تاريخ انتهاء الاشتراك</span>
                <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="input-premium text-xs" style={{ direction: 'ltr' }} required />
              </label>
              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => setEditingUser(null)} className="btn-secondary flex-1 py-3 text-xs justify-center font-bold" disabled={updating}>
                  إلغاء
                </button>
                <button type="submit" className="btn-primary flex-1 py-3 text-xs justify-center font-bold bg-gradient-to-r from-[#ff9100] to-[#ff3d00] border-none text-white!" disabled={updating}>
                  {updating ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeletingUser(null)} />
          <div className="relative z-10 w-full max-w-sm bg-[#0e1622] border border-red-500/20 rounded-2xl p-6 shadow-2xl animate-fade-in text-right">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">حذف حساب العميل نهائيا؟</h3>
            <p className="text-xs text-[#90a4ae] mt-2 leading-relaxed">
              سيتم حذف العميل <span className="text-white font-bold">{deletingUser.email}</span> وكل أرقامه واشتراكاته وسجلاته. لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeletingUser(null)} className="btn-secondary flex-1 py-2.5 text-xs justify-center font-bold" disabled={deleting}>
                إلغاء
              </button>
              <button onClick={handleDeleteUser} className="btn-primary flex-1 py-2.5 text-xs justify-center font-bold bg-red-600 hover:bg-red-700 border-none text-white!" disabled={deleting}>
                {deleting ? 'جاري الحذف...' : 'نعم، احذف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setResettingUser(null)} />
          <div className="relative z-10 w-full max-w-sm bg-[#0e1622] border border-yellow-500/20 rounded-2xl p-6 shadow-2xl animate-fade-in text-right">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 mb-4">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">إعادة تعيين رصيد الاستهلاك؟</h3>
            <p className="text-xs text-[#90a4ae] mt-2 leading-relaxed">
              هل أنت متأكد من إعادة تعيين رصيد الاستهلاك الشهري للعميل <span className="text-white font-bold">{resettingUser.name || resettingUser.email}</span> إلى صفر؟ هذا سيسمح له بالإرسال من جديد كأن رصيده قد تجدد.
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setResettingUser(null)} className="btn-secondary flex-1 py-2.5 text-xs justify-center font-bold" disabled={resetting}>
                إلغاء
              </button>
              <button onClick={handleResetQuota} className="btn-primary flex-1 py-2.5 text-xs justify-center font-bold bg-yellow-600 hover:bg-yellow-700 border-none text-white!" disabled={resetting}>
                {resetting ? 'جاري التصفير...' : 'نعم، أعد التعيين'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResourceContent({
  view,
  data,
  actionId,
  onInstanceAction,
  onClearLogs,
  loadingMoreLogs = false,
  hasMoreLogs = false
}: {
  view: 'usage' | 'inbox' | 'instances' | 'logs';
  data: any;
  actionId: string | null;
  onInstanceAction: (instanceId: string, action: 'DISCONNECT_INSTANCE' | 'DELETE_INSTANCE') => void;
  onClearLogs: () => void;
  loadingMoreLogs?: boolean;
  hasMoreLogs?: boolean;
}) {
  if (view === 'usage') {
    const usage = data?.usage || {};
    const cards = [
      ['أرقام واتساب', usage.instancesTotal || 0],
      ['الأرقام المتصلة', usage.instancesConnected || 0],
      ['رسائل الصندوق', usage.inboxMessages || 0],
      ['جهات الاتصال', usage.contacts || 0],
      ['الحملات', usage.campaigns || 0],
      ['رسائل مرسلة', usage.messages?.SENT || 0],
      ['رسائل واردة', usage.messages?.RECEIVED || 0],
      ['رسائل فاشلة', usage.messages?.FAILED || 0]
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(([label, value]) => (
          <div key={label} className="bg-[#0c121c] rounded-xl border border-[rgba(255,255,255,0.04)] p-4">
            <span className="text-[10px] text-[#607d8b] font-bold">{label}</span>
            <div className="text-2xl font-black text-white mt-2">{value}</div>
          </div>
        ))}
      </div>
    );
  }

  if (view === 'instances') {
    const instances = data?.instances || [];
    return (
      <div className="flex flex-col gap-3">
        {instances.length === 0 ? (
          <EmptyState text="لا توجد أرقام واتساب لهذا العميل." />
        ) : instances.map((instance: any) => (
          <div key={instance.id} className="bg-[#0c121c] rounded-xl border border-[rgba(255,255,255,0.04)] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="text-right">
              <div className="font-bold text-white">{instance.name}</div>
              <div className="text-[10px] text-[#607d8b] font-mono mt-1">{instance.jid || instance.id}</div>
              <div className="text-[10px] text-[#90a4ae] mt-2">
                رسائل السجل: {instance._count?.logs || 0} | الصندوق: {instance._count?.inboxMessages || 0} | جهات الاتصال: {instance._count?.chatContacts || 0}
              </div>
            </div>
            <div className="flex items-center gap-2 justify-start">
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${instance.status === 'CONNECTED' ? 'bg-[#00ffa7]/10 text-[#00ffa7]' : 'bg-red-500/10 text-red-500'}`}>
                {statusText(instance.status)}
              </span>
              <button onClick={() => onInstanceAction(instance.id, 'DISCONNECT_INSTANCE')} disabled={actionId === instance.id} className="p-2 rounded-lg bg-[#121620] hover:bg-orange-500/10 border border-[rgba(255,255,255,0.04)] text-[#90a4ae] hover:text-orange-400 transition-all" title="قطع الاتصال">
                <LogOut className="w-4 h-4" />
              </button>
              <button onClick={() => onInstanceAction(instance.id, 'DELETE_INSTANCE')} disabled={actionId === instance.id} className="p-2 rounded-lg bg-[#121620] hover:bg-red-500/10 border border-[rgba(255,255,255,0.04)] text-[#90a4ae] hover:text-red-500 transition-all" title="حذف الرقم">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (view === 'inbox') {
    return <AdminInboxPanel data={data} />;
  }

  if (view === 'logs') {
    const logs = data?.logs || [];
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <button onClick={onClearLogs} disabled={actionId === 'logs'} className="btn-secondary py-2.5 px-4 text-xs font-bold text-red-400 hover:text-red-300">
            <Trash2 className="w-4 h-4" />
            حذف سجل الرسائل
          </button>
          <div className="flex items-center gap-4 text-xs text-[#90a4ae]">
            <span>المعروض: {logs.length}</span>
            <span>|</span>
            <span>إجمالي السجلات: {data?.totalCount || 0}</span>
          </div>
        </div>
        <MessagesTable rows={logs} emptyText="لا توجد سجلات رسائل لهذا العميل." />
        {loadingMoreLogs && (
          <div className="py-4 flex items-center justify-center gap-2 text-xs text-[#90a4ae]">
            <Activity className="w-4 h-4 animate-spin text-[#00ffa7]" />
            جاري تحميل المزيد من السجلات...
          </div>
        )}
        {!hasMoreLogs && logs.length > 0 && (
          <div className="py-4 text-center text-[10px] text-[#607d8b]">
            لقد وصلت إلى نهاية سجل الرسائل.
          </div>
        )}
      </div>
    );
  }
}

function AdminInboxPanel({ data }: { data: any }) {
  const [chats, setChats] = useState<any[]>(data?.chats || []);
  const [selectedChat, setSelectedChat] = useState<any>((data?.chats || [])[0] || null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageError, setMessageError] = useState('');
  const [search, setSearch] = useState('');
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);

  const isDeletedMessageText = (text: string | null | undefined) => {
    if (!text?.startsWith('{"_isDeleted":')) return false;
    try {
      return Boolean(JSON.parse(text)._isDeleted);
    } catch {
      return false;
    }
  };

  const renderMessageContent = (text: string) => {
    if (isDeletedMessageText(text)) {
      return <span className="italic text-[#90a4ae]">تم حذف هذه الرسالة</span>;
    }

    if (text && text.startsWith('{"_isMedia":')) {
      try {
        const media = JSON.parse(text);
        const src = media.mediaUrl || (media.base64 ? `data:${media.mimetype};base64,${media.base64}` : '');
        
        if (!src) {
          return <span className="text-[#90a4ae] italic">فشل تحميل الوسائط</span>;
        }

        if (media.mediaType === 'image') {
          return (
            <div className="flex flex-col gap-2">
              <img 
                src={src} 
                alt="صورة" 
                className="rounded-xl max-w-full max-h-[260px] object-contain cursor-zoom-in border border-white/5 hover:border-white/10 transition-all" 
                onClick={() => setActiveLightboxImg(src)} 
              />
              {media.caption && <p className="whitespace-pre-wrap leading-relaxed break-all mt-1">{media.caption}</p>}
            </div>
          );
        }
        if (media.mediaType === 'video') {
          return (
            <div className="flex flex-col gap-2">
              <video src={src} controls className="rounded-xl max-w-full max-h-[260px]" />
              {media.caption && <p className="whitespace-pre-wrap leading-relaxed break-all mt-1">{media.caption}</p>}
            </div>
          );
        }
        if (media.mediaType === 'audio') {
          return (
            <div className="flex flex-col gap-1 py-1">
              <audio src={src} controls className="max-w-full h-9 accent-[#00ffa7]" />
            </div>
          );
        }
        if (media.mediaType === 'sticker') {
          return (
            <img src={src} alt="ملصق" className="max-w-[120px] max-h-[120px] object-contain" />
          );
        }
        
        // Document
        return (
          <a 
            href={src} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-2.5 p-3 rounded-xl bg-black/15 hover:bg-black/25 text-[#00ffa7] hover:text-[#00ffa7]/90 font-semibold transition-all border border-white/5"
          >
            <span className="text-xl">📄</span>
            <div className="flex flex-col min-w-0">
              <span className="truncate max-w-[180px] text-[11px] text-white">{media.fileName || 'ملف مستند'}</span>
              <span className="text-[9px] text-[#90a4ae] mt-0.5">انقر للمعاينة والتنزيل</span>
            </div>
          </a>
        );
      } catch {
        return <p className="whitespace-pre-wrap leading-relaxed break-all">{text}</p>;
      }
    }
    
    // Normal text message
    return <p className="whitespace-pre-wrap leading-relaxed break-all sm:break-normal">{text}</p>;
  };

  useEffect(() => {
    const nextChats = data?.chats || [];
    setChats(nextChats);
    setSelectedChat(nextChats[0] || null);
  }, [data]);

  useEffect(() => {
    async function loadMessages() {
      if (!selectedChat || !data?.user?.id) {
        setMessages([]);
        return;
      }

      setLoadingMessages(true);
      setMessageError('');

      try {
        const params = new URLSearchParams({
          view: 'inbox',
          mode: 'messages',
          instanceId: selectedChat.instanceId,
          number: selectedChat.number,
          limit: '100'
        });
        const res = await fetch(`/api/admin/users/${data.user.id}/resources?${params.toString()}`, { cache: 'no-store' });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'Failed to load messages.');
        setMessages(payload.messages || []);
      } catch (err: any) {
        setMessageError(err.message);
        setMessages([]);
      } finally {
        setLoadingMessages(false);
      }
    }

    loadMessages();
  }, [data?.user?.id, selectedChat]);

  const filteredChats = chats.filter(chat => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      String(chat.number || '').toLowerCase().includes(term) ||
      String(chat.contactName || '').toLowerCase().includes(term) ||
      String(chat.lastMessage || '').toLowerCase().includes(term) ||
      String(chat.instanceName || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] h-[75vh] min-h-[560px]" dir="rtl">
      <aside className="border-l border-[rgba(255,255,255,0.06)] bg-[#0b111a] flex flex-col min-h-0">
        <div className="p-4 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2 bg-[#121e2a]/70 border border-[rgba(255,255,255,0.04)] px-3 py-2 rounded-xl">
            <Search className="w-4 h-4 text-[#607d8b]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في المحادثات..."
              className="bg-transparent border-none outline-none text-white text-xs flex-1 text-right"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <EmptyState text="لا توجد محادثات في الصندوق الوارد لهذا العميل." />
          ) : filteredChats.map((chat) => {
            const active = selectedChat?.instanceId === chat.instanceId && selectedChat?.number === chat.number;
            return (
              <button
                key={`${chat.instanceId}-${chat.number}`}
                onClick={() => setSelectedChat(chat)}
                className={`w-full p-4 text-right border-b border-[rgba(255,255,255,0.04)] transition-all ${
                  active ? 'bg-[#00ffa7]/10' : 'bg-transparent hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white text-xs truncate">
                        {chat.contactName || chat.number}
                      </span>
                      <span className="text-[9px] text-[#607d8b] shrink-0" suppressHydrationWarning>
                        {chat.lastMessageTime ? new Date(chat.lastMessageTime).toLocaleDateString('ar-EG') : ''}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#607d8b] font-mono mt-0.5 truncate" dir="ltr">
                      {chat.number}
                    </div>
                    <div className="text-[10px] text-[#90a4ae] mt-1 truncate">
                      {chat.lastMessage}
                    </div>
                    <div className="text-[9px] text-[#607d8b] mt-1 truncate">
                      {chat.instanceName}
                    </div>
                  </div>
                  {chat.unreadCount > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#00ffa7] text-[#061016] text-[10px] font-black flex items-center justify-center">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="bg-[#071018] flex flex-col min-h-0">
        {selectedChat ? (
          <>
            <div className="p-4 border-b border-[rgba(255,255,255,0.06)] bg-[#0b111a] flex items-center justify-between gap-4">
              <div className="text-right min-w-0">
                <div className="font-bold text-white text-sm truncate">{selectedChat.contactName || selectedChat.number}</div>
                <div className="text-[10px] text-[#607d8b] mt-1">
                  <span className="font-mono" dir="ltr">{selectedChat.number}</span>
                  <span className="mx-2">|</span>
                  <span>{selectedChat.instanceName}</span>
                </div>
              </div>
              <MessageSquareText className="w-5 h-5 text-[#00ffa7]" />
            </div>

            <div className="flex-1 overflow-y-auto p-5 bg-[radial-gradient(circle_at_top_right,rgba(0,255,167,0.04),transparent_35%)]">
              {loadingMessages ? (
                <div className="h-full flex items-center justify-center text-[#90a4ae] text-xs gap-2">
                  <Activity className="w-4 h-4 animate-spin text-[#00ffa7]" />
                  جاري تحميل الرسائل...
                </div>
              ) : messageError ? (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs">{messageError}</div>
              ) : messages.length === 0 ? (
                <EmptyState text="لا توجد رسائل داخل هذه المحادثة." />
              ) : (
                <div className="flex flex-col gap-3">
                  {messages.map((message) => {
                    const sent = message.type === 'SENT';

                    // Check for group message wrapping
                    let isGroupMsg = false;
                    let groupSenderName = '';
                    let messageText = message.text;

                    if (message.text && message.text.startsWith('{"_isGroupMessage":')) {
                      try {
                        const parsedGroup = JSON.parse(message.text);
                        isGroupMsg = true;
                        groupSenderName = parsedGroup.senderName;
                        messageText = parsedGroup.text;
                      } catch {}
                    }

                    // Parse quoted message info if it is a reply
                    let isReply = false;
                    let replyInfo: any = null;

                    if (messageText && messageText.startsWith('{"_isReply":')) {
                      try {
                        replyInfo = JSON.parse(messageText);
                        isReply = true;
                        messageText = replyInfo.text;
                      } catch {}
                    }

                    const isDeleted = isDeletedMessageText(messageText);

                    return (
                      <div key={message.id} className={`flex ${sent ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] rounded-2xl px-4 py-2.5 border text-right ${
                          sent
                            ? 'bg-[#00ffa7]/12 border-[#00ffa7]/20 text-white rounded-tr-md'
                            : 'bg-[#121e2a] border-[rgba(255,255,255,0.05)] text-white rounded-tl-md'
                        }`}>
                          {isGroupMsg && !sent && (
                            <span className="text-[10px] font-extrabold text-[#00ffa7] mb-1 block">
                              {groupSenderName}
                            </span>
                          )}
                          {!isDeleted && isReply && replyInfo && (
                            <div className="mb-2 p-2 rounded bg-black/20 border-r-2 border-[#00ffa7] text-right text-[10px] text-gray-400">
                              <div className="font-bold text-[#00ffa7] mb-0.5">
                                {replyInfo.quotedParticipant ? replyInfo.quotedParticipant : 'مستخدم'}
                              </div>
                              <div className="truncate max-w-[250px] italic">
                                {replyInfo.quotedText}
                              </div>
                            </div>
                          )}
                          <div className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                            {renderMessageContent(messageText)}
                          </div>
                          <div className="mt-1.5 flex items-center justify-end gap-2 text-[9px] text-[#607d8b]" suppressHydrationWarning>
                            <span>{new Date(message.createdAt).toLocaleString('ar-EG')}</span>
                            <span>{sent ? 'مرسلة' : 'واردة'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          <EmptyState text="اختر محادثة من القائمة لعرض الرسائل." />
        )}
      </section>

      {activeLightboxImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setActiveLightboxImg(null)}>
          <img src={activeLightboxImg} alt="معاينة" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl animate-zoom-in" />
          <button className="absolute top-4 left-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

function MessagesTable({ rows, emptyText }: { rows: any[]; emptyText: string }) {
  if (!rows.length) return <EmptyState text={emptyText} />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right border-collapse text-xs">
        <thead>
          <tr className="border-b border-[rgba(255,255,255,0.04)] text-[#607d8b] font-bold">
            <th className="pb-3 text-right">الرقم</th>
            <th className="pb-3 text-right">المحتوى</th>
            <th className="pb-3 text-center">النوع</th>
            <th className="pb-3 text-center">رقم واتساب</th>
            <th className="pb-3 text-left">التاريخ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[rgba(255,255,255,0.03)] text-[#90a4ae]">
              <td className="py-3 font-mono text-white">{row.number}</td>
              <td className="py-3 max-w-[360px]">
                <div className="flex items-start gap-2 justify-end">
                  <span className="line-clamp-2">{row.text}</span>
                  <MessageSquareText className="w-3.5 h-3.5 text-[#607d8b] mt-0.5 flex-shrink-0" />
                </div>
              </td>
              <td className="py-3 text-center">{row.type}</td>
              <td className="py-3 text-center">{row.instance?.name || '-'}</td>
              <td className="py-3 text-left font-mono text-[10px]" suppressHydrationWarning>
                {new Date(row.createdAt).toLocaleString('ar-EG')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-12 flex flex-col items-center gap-3 text-center text-[#607d8b] text-xs">
      <Inbox className="w-8 h-8" />
      {text}
    </div>
  );
}
