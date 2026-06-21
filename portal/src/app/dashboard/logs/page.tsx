'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ListFilter, 
  Search, 
  Trash2, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertCircle, 
  Smartphone, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Database
} from 'lucide-react';

export default function LogsPage() {
  // Logs State
  const [logs, setLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);

  // Filter States
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstance, setSelectedInstance] = useState('ALL');
  const [selectedType, setSelectedType] = useState('ALL');
  const [searchNumber, setSearchNumber] = useState('');
  const [searchText, setSearchText] = useState('');

  // Auto Refresh State
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Delete Modal
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Fetch instances to populate dropdown
  useEffect(() => {
    async function fetchInstances() {
      try {
        const res = await fetch('/api/instances');
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          setInstances(data);
        }
      } catch (err) {
        console.error('Error fetching instances for filters:', err);
      }
    }
    fetchInstances();
  }, []);

  // Fetch logs function wrapped in useCallback
  const fetchLogs = useCallback(async (pageNum = 1, showRefreshState = false) => {
    if (showRefreshState) setIsRefreshing(true);
    try {
      const queryParams = new URLSearchParams({
        page: pageNum.toString(),
        limit: pagination.limit.toString()
      });

      if (selectedInstance && selectedInstance !== 'ALL') {
        queryParams.append('instanceId', selectedInstance);
      }
      if (selectedType && selectedType !== 'ALL') {
        queryParams.append('type', selectedType);
      }
      if (searchNumber) {
        queryParams.append('number', searchNumber);
      }
      if (searchText) {
        queryParams.append('search', searchText);
      }

      const res = await fetch(`/api/logs?${queryParams.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setLogs(data.logs || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch (err) {
      console.error('Error fetching message logs:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [pagination.limit, selectedInstance, selectedType, searchNumber, searchText]);

  // Handle pagination page change
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchLogs(newPage, true);
  };

  // Trigger fetch when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchLogs(1, true);
  }, [selectedInstance, selectedType, searchNumber, searchText, fetchLogs]);

  // Auto Refresh Interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLogs(pagination.page, false);
    }, 5000); // refresh every 5 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, pagination.page, fetchLogs]);

  // Handle Clear Logs
  const handleClearLogs = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/logs', {
        method: 'DELETE'
      });

      if (res.ok) {
        setLogs([]);
        setPagination({
          page: 1,
          limit: 50,
          totalCount: 0,
          totalPages: 1
        });
        setDeleteConfirmOpen(false);
      }
    } catch (err) {
      console.error('Error clearing logs:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSelectedInstance('ALL');
    setSelectedType('ALL');
    setSearchNumber('');
    setSearchText('');
  };

  return (
    <>
      <div className="flex flex-col gap-8 text-right animate-fade-in relative">
        {/* Title Block */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ffa7] to-[#00b0ff] flex items-center justify-center shadow-lg shadow-[#00ffa7]/15">
              <Database className="w-5 h-5 text-[#060b11]" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white">سجل الرسائل</h1>
              <p className="text-xs text-[#90a4ae] mt-1">تتبع كافة الرسائل الصادرة والواردة والمؤتمتة لحظة بلحظة.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            {/* Auto Refresh Toggle */}
            <label className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#0e1622] border border-[rgba(255,255,255,0.06)] cursor-pointer text-xs font-semibold text-[#90a4ae] hover:text-white transition-all select-none">
              <input 
                type="checkbox" 
                checked={autoRefresh} 
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-[#00ffa7] focus:ring-[#00ffa7]/30 w-4 h-4 cursor-pointer"
              />
              <span>تحديث تلقائي (5ث)</span>
            </label>

            {/* Manual Refresh */}
            <button 
              onClick={() => fetchLogs(pagination.page, true)}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl bg-[#0e1622] border border-[rgba(255,255,255,0.06)] hover:border-[#00ffa7]/20 text-[#90a4ae] hover:text-white transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#00ffa7]' : ''}`} />
            </button>

            {/* Clear Logs */}
            <button 
              onClick={() => setDeleteConfirmOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/30 text-red-500 text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">تفريغ السجل</span>
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <div className="glass-card flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* WhatsApp Instance Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#90a4ae]">رقم/حساب الواتساب</label>
              <select 
                value={selectedInstance} 
                onChange={(e) => setSelectedInstance(e.target.value)}
                className="w-full bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-white rounded-xl px-3 py-2.5 text-xs outline-none transition-all cursor-pointer"
              >
                <option value="ALL">كل الحسابات</option>
                {instances.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>

            {/* Message Type Filter */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#90a4ae]">نوع وحالة الرسالة</label>
              <select 
                value={selectedType} 
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-white rounded-xl px-3 py-2.5 text-xs outline-none transition-all cursor-pointer"
              >
                <option value="ALL">الكل (صادر ووارد)</option>
                <option value="SENT">الرسائل الصادرة (SENT)</option>
                <option value="RECEIVED">الرسائل الواردة (RECEIVED)</option>
                <option value="FAILED">الرسائل الفاشلة (FAILED)</option>
              </select>
            </div>

            {/* Search Number */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#90a4ae]">رقم هاتف المستلم/المرسل</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  placeholder="ابحث بالرقم..."
                  className="w-full bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-white rounded-xl pr-9 pl-3 py-2.5 text-xs outline-none transition-all placeholder-[#607d8b]"
                />
                <Smartphone className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#607d8b]" />
              </div>
            </div>

            {/* Search Text */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[#90a4ae]">محتوى الرسالة</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="ابحث في نص الرسالة..."
                  className="w-full bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-white rounded-xl pr-9 pl-3 py-2.5 text-xs outline-none transition-all placeholder-[#607d8b]"
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#607d8b]" />
              </div>
            </div>
          </div>

          {(selectedInstance !== 'ALL' || selectedType !== 'ALL' || searchNumber || searchText) && (
            <div className="flex justify-end mt-1">
              <button 
                onClick={handleResetFilters}
                className="text-xs text-[#90a4ae] hover:text-[#00ffa7] underline transition-all bg-transparent border-none cursor-pointer"
              >
                إلغاء جميع الفلاتر
              </button>
            </div>
          )}
        </div>

        {/* Logs Table / List */}
        <div className="glass-card overflow-hidden p-0 border border-[rgba(255,255,255,0.06)]">
          {loading ? (
            /* Loading State */
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-[#00ffa7] animate-spin" />
              <span className="text-xs text-[#90a4ae]">جاري جلب سجل الرسائل...</span>
            </div>
          ) : logs.length === 0 ? (
            /* Empty State */
            <div className="py-24 px-6 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-[#0e1622] flex items-center justify-center border border-[rgba(255,255,255,0.04)] text-[#607d8b]">
                <ListFilter className="w-8 h-8" />
              </div>
              <div className="max-w-xs">
                <h3 className="text-sm font-bold text-white mb-1">لا توجد رسائل مسجلة</h3>
                <p className="text-xs text-[#90a4ae] leading-relaxed">
                  لم يتم العثور على أي رسائل تطابق فلاتر البحث الحالية، أو لم يتم إرسال واستقبال رسائل بعد.
                </p>
              </div>
            </div>
          ) : (
            /* Table list */
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-[#0b1019] text-[#90a4ae] text-[10px] uppercase font-black tracking-wider border-b border-[rgba(255,255,255,0.04)]">
                    <th className="py-4 px-6">الحالة</th>
                    <th className="py-4 px-4">رقم الجوال</th>
                    <th className="py-4 px-4">رقم الواتساب المرسل</th>
                    <th className="py-4 px-4">نص الرسالة</th>
                    <th className="py-4 px-4">التاريخ والوقت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.03)]">
                  {logs.map((log) => {
                    const isSent = log.type === 'SENT';
                    const isReceived = log.type === 'RECEIVED';
                    
                    let statusIcon = <AlertCircle className="w-4 h-4 text-red-500" />;
                    let statusLabel = 'فشلت';
                    let statusClass = 'text-red-500 bg-red-500/10 border border-red-500/20';
                    
                    if (isSent) {
                      statusIcon = <ArrowUpRight className="w-4 h-4 text-[#00ffa7]" />;
                      statusLabel = 'صادرة';
                      statusClass = 'text-[#00ffa7] bg-[#00ffa7]/10 border border-[#00ffa7]/20';
                    } else if (isReceived) {
                      statusIcon = <ArrowDownLeft className="w-4 h-4 text-[#00b0ff]" />;
                      statusLabel = 'واردة';
                      statusClass = 'text-[#00b0ff] bg-[#00b0ff]/10 border border-[#00b0ff]/20';
                    }

                    return (
                      <tr key={log.id} className="hover:bg-white/[0.01] transition-all text-xs">
                        {/* Status */}
                        <td className="py-4.5 px-6">
                          <div className="flex items-center gap-2 justify-start">
                            <span className={`p-1 rounded-lg ${statusClass.split(' ')[1]}`}>
                              {statusIcon}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </div>
                        </td>
                        
                        {/* Recipient Phone */}
                        <td className="py-4.5 px-4 font-mono font-semibold text-white tracking-wider">
                          {log.number}
                        </td>
                        
                        {/* WhatsApp Instance */}
                        <td className="py-4.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0e1622] text-[#90a4ae] border border-[rgba(255,255,255,0.04)] font-semibold">
                            <MessageSquare className="w-3 h-3 text-[#00ffa7]" />
                            {log.instance?.name || 'غير معروف'}
                          </span>
                        </td>
                        
                        {/* Message Content */}
                        <td className="py-4.5 px-4 max-w-sm">
                          <div className="text-white text-xs leading-relaxed break-words whitespace-pre-wrap line-clamp-2 hover:line-clamp-none transition-all duration-300">
                            {log.text}
                          </div>
                        </td>
                        
                        {/* Date & Time */}
                        <td className="py-4.5 px-4 text-[#607d8b] font-medium whitespace-nowrap">
                          <div className="flex items-center gap-1.5 justify-start">
                            <Clock className="w-3.5 h-3.5 text-[#607d8b]" />
                            <span suppressHydrationWarning>{new Date(log.createdAt).toLocaleString('ar-EG')}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!loading && logs.length > 0 && (
            <div className="bg-[#0b1019] px-6 py-4 flex items-center justify-between border-t border-[rgba(255,255,255,0.04)] text-xs">
              <span className="text-[#607d8b]">
                عرض <strong className="text-white font-bold">{logs.length}</strong> من إجمالي <strong className="text-white font-bold">{pagination.totalCount}</strong> رسالة
              </span>

              <div className="flex items-center gap-2">
                {/* Previous Page (RTL - right button goes to previous page, arrow points right) */}
                <button 
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-1.5 rounded-lg bg-[#0e1622] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)] text-[#90a4ae] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:hover:text-[#90a4ae]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                
                <span className="text-[#90a4ae] font-semibold">
                  صفحة <strong className="text-white font-black">{pagination.page}</strong> من <strong className="text-white font-black">{pagination.totalPages}</strong>
                </span>

                {/* Next Page (RTL - left button goes to next page, arrow points left) */}
                <button 
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="p-1.5 rounded-lg bg-[#0e1622] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)] text-[#90a4ae] hover:text-white transition-all cursor-pointer disabled:opacity-30 disabled:hover:text-[#90a4ae]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* --- CONFIRM CLEAR LOGS MODAL --- */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!deleteLoading) setDeleteConfirmOpen(false); }}
          ></div>
          
          <div className="relative z-10 w-full max-w-sm bg-[#0e1622] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-2xl animate-fade-in text-right">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4 mx-auto sm:mx-0">
                <Trash2 className="w-6 h-6" />
              </div>
              
              <h3 className="text-base font-bold text-white mb-2">هل أنت متأكد من إفراغ سجل الرسائل؟</h3>
              <p className="text-xs text-[#90a4ae] leading-relaxed mb-6">
                سيقوم هذا الإجراء بحذف جميع سجلات إرسال واستقبال الرسائل الخاصة بك من قاعدة البيانات نهائياً. لا يمكن التراجع عن هذا الإجراء.
              </p>

              <div className="flex items-center gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOpen(false)}
                  disabled={deleteLoading}
                  className="px-4 py-2.5 rounded-xl border border-[rgba(255,255,255,0.06)] text-xs font-bold text-[#90a4ae] hover:text-white hover:bg-white/[0.01] transition-all cursor-pointer disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleClearLogs}
                  disabled={deleteLoading}
                  className="px-4 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {deleteLoading ? 'جاري الحذف...' : 'نعم، قم بالحذف'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
