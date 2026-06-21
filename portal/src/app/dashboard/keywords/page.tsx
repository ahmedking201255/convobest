'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  HelpCircle,
  Plus,
  Trash2,
  Edit,
  FileText,
  AlertCircle,
  AlertTriangle,
  Check,
  X,
  MessageCircle
} from 'lucide-react';
import Link from 'next/link';

export default function KeywordsPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [loadingInstances, setLoadingInstances] = useState(true);

  // User session
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Keyword Rules State
  const [rules, setRules] = useState<any[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null); // Null for create, object for edit
  const [ruleError, setRuleError] = useState('');
  const [ruleSuccess, setRuleSuccess] = useState('');

  // Keyword Form States
  const [keyword, setKeyword] = useState('');
  const [matchType, setMatchType] = useState('CONTAINS'); // EXACT, CONTAINS
  const [replyText, setReplyText] = useState('');
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [savingRule, setSavingRule] = useState(false);

  // Fetch Session and Instances
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

  // Fetch Keyword Rules
  const fetchKeywordRules = useCallback(async (instanceId: string) => {
    setLoadingRules(true);
    try {
      const res = await fetch(`/api/chatbot/keywords?instanceId=${instanceId}`);
      const data = await res.json();
      if (res.ok) {
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error('Error fetching keyword rules:', err);
    } finally {
      setLoadingRules(false);
    }
  }, []);

  // Trigger fetch when instance changes
  useEffect(() => {
    if (selectedInstanceId) {
      fetchKeywordRules(selectedInstanceId);
    }
  }, [selectedInstanceId, fetchKeywordRules]);

  // Open modal
  const handleOpenRuleModal = (rule: any = null) => {
    setEditingRule(rule);
    setRuleError('');
    setRuleSuccess('');

    if (rule) {
      setKeyword(rule.keyword);
      setMatchType(rule.matchType);
      setReplyText(rule.replyText);
      setRuleEnabled(rule.enabled);
    } else {
      setKeyword('');
      setMatchType('CONTAINS');
      setReplyText('');
      setRuleEnabled(true);
    }

    setRuleModalOpen(true);
  };

  // Save rule
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstanceId) return;

    setSavingRule(true);
    setRuleError('');
    setRuleSuccess('');

    try {
      const res = await fetch('/api/chatbot/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingRule?.id || undefined,
          instanceId: selectedInstanceId,
          keyword,
          matchType,
          replyText,
          enabled: ruleEnabled
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save rule');

      setRuleSuccess(editingRule ? 'تم تحديث قاعدة الرد التلقائي بنجاح' : 'تم إضافة قاعدة الرد التلقائي بنجاح');
      
      // Refresh list
      fetchKeywordRules(selectedInstanceId);

      setTimeout(() => {
        setRuleModalOpen(false);
        setRuleSuccess('');
      }, 1000);
    } catch (err: any) {
      setRuleError(err.message);
    } finally {
      setSavingRule(false);
    }
  };

  // Toggle rule state inline
  const handleToggleRule = async (rule: any) => {
    try {
      const res = await fetch('/api/chatbot/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rule.id,
          instanceId: selectedInstanceId,
          keyword: rule.keyword,
          matchType: rule.matchType,
          replyText: rule.replyText,
          enabled: !rule.enabled
        })
      });

      if (res.ok) {
        setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
      }
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  // Delete rule
  const handleDeleteRule = async (id: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف قاعدة الكلمة المفتاحية هذه؟')) return;

    try {
      const res = await fetch(`/api/chatbot/keywords?id=${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete rule');
      }
    } catch (err) {
      console.error('Delete rule error:', err);
    }
  };

  if (loadingInstances || loadingSession) {
    return (
      <div className="h-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ffa7] to-[#00b0ff] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#060b11] animate-spin" />
          </div>
          <span className="text-xs text-[#90a4ae]">جاري تهيئة إعدادات الردود التلقائية...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 text-right animate-fade-in relative">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">الردود التلقائية بالكلمات المفتاحية</h1>
        <p className="text-xs text-[#90a4ae] mt-1">قم بتهيئة قواعد ردود فورية مع عملائك بناءً على كلمات مفتاحية معينة لتوفير ردود سريعة وتوفير رصيد الاستهلاك.</p>
      </div>

      {instances.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center text-center py-16 px-6 gap-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="flex flex-col gap-1.5 max-w-md">
            <h3 className="text-lg font-bold text-white">لم تقم بربط أي رقم هاتف متصل حالياً</h3>
            <p className="text-xs text-[#90a4ae] leading-relaxed">
              لتفعيل قواعد الردود التلقائية بالكلمات المفتاحية، يجب أولاً ربط رقم هاتف واتساب واحد على الأقل وتفعيل اتصاله بالمسح الضوئي للـ QR.
            </p>
          </div>
          <Link href="/dashboard/instances" className="btn-primary text-xs font-bold py-3 px-6">
            اذهب لربط رقم واتساب بالمسح الضوئي
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Rules List Panel */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Instance Selector & Add Rule Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] font-bold text-[#90a4ae]">رقم الواتساب النشط</label>
                <select 
                  value={selectedInstanceId}
                  onChange={(e) => setSelectedInstanceId(e.target.value)}
                  className="bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-white rounded-xl px-3 py-2.5 text-xs outline-none transition-all cursor-pointer"
                >
                  {instances.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => handleOpenRuleModal()}
                className="btn-primary py-3 px-5 text-xs font-bold flex items-center gap-1.5 self-end sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة قاعدة رد جديدة</span>
              </button>
            </div>

            {/* Rules Table */}
            <div className="glass-card overflow-hidden p-0 border border-[rgba(255,255,255,0.06)]">
              {loadingRules ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Activity className="w-6 h-6 text-[#00ffa7] animate-spin" />
                  <span className="text-[10px] text-[#90a4ae]">جاري جلب القواعد...</span>
                </div>
              ) : rules.length === 0 ? (
                <div className="py-20 px-6 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#0e1622] flex items-center justify-center border border-[rgba(255,255,255,0.04)] text-[#607d8b]">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="max-w-xs">
                    <h4 className="text-xs font-bold text-white mb-1">لا توجد قواعد كلمات مفتاحية بعد</h4>
                    <p className="text-[10px] text-[#90a4ae] leading-relaxed">
                      قم بإضافة قواعد مخصصة (مثل الرد التلقائي بكلمة "الأسعار" أو "مرحبا") للرد الفوري على عملائك.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-[#0b1019] text-[#90a4ae] text-[9px] uppercase font-black tracking-wider border-b border-[rgba(255,255,255,0.04)]">
                        <th className="py-3 px-6">الكلمة المفتاحية (Keyword)</th>
                        <th className="py-3 px-4">نوع التطابق</th>
                        <th className="py-3 px-4">نص الرد التلقائي</th>
                        <th className="py-3 px-4">الحالة</th>
                        <th className="py-3 px-6 text-left">التحكم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgba(255,255,255,0.03)] text-xs">
                      {rules.map((rule) => (
                        <tr key={rule.id} className="hover:bg-white/[0.005] transition-all">
                          {/* Keyword */}
                          <td className="py-4 px-6 font-bold text-[#00ffa7] font-mono">
                            {rule.keyword}
                          </td>

                          {/* Match Type */}
                          <td className="py-4 px-4">
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-black ${
                              rule.matchType === 'EXACT'
                                ? 'bg-[#00ffa7]/10 text-[#00ffa7] border border-[#00ffa7]/20'
                                : 'bg-[#00b0ff]/10 text-[#00b0ff] border border-[#00b0ff]/20'
                            }`}>
                              {rule.matchType === 'EXACT' ? 'تطابق كلي' : 'يحتوي على الكلمة'}
                            </span>
                          </td>

                          {/* Reply Text */}
                          <td className="py-4 px-4 max-w-xs truncate font-medium text-[#90a4ae]">
                            {rule.replyText}
                          </td>

                          {/* Enabled state */}
                          <td className="py-4 px-4">
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={rule.enabled} 
                                onChange={() => handleToggleRule(rule)}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-[#162232] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#060b11] after:border-none after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00ffa7] peer-checked:after:bg-[#060b11]"></div>
                            </label>
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-6 text-left">
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => handleOpenRuleModal(rule)}
                                className="p-1.5 rounded-lg border border-[rgba(255,255,255,0.06)] hover:border-[#00ffa7]/20 text-[#607d8b] hover:text-[#00ffa7] transition-all cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="p-1.5 rounded-lg border border-red-500/10 hover:border-red-500/20 text-red-500/60 hover:text-red-500 transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* Instructions Panel */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="glass-card flex flex-col gap-4 border-l-4 border-l-[#00ffa7]">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5 justify-end">
                <span>الرد بالكلمات المفتاحية</span>
                <HelpCircle className="w-4 h-4 text-[#00ffa7]" />
              </h3>
              <hr className="border-[rgba(255,255,255,0.04)]" />
              <ul className="flex flex-col gap-3 text-xs text-[#90a4ae] leading-relaxed list-disc pr-4 text-right">
                <li>
                  تعد هذه الميزة مجانية ومدعومة بالكامل لكافة باقات المنصة بما فيها الباقة الأساسية Starter.
                </li>
                <li>
                  **تطابق كلي:** يتم تفعيل الرد فقط إذا كانت رسالة العميل مطابقة تماماً للكلمة المكتوبة دون أي زيادة أو نقصان.
                </li>
                <li>
                  **يحتوي على الكلمة:** يتم تفعيل الرد إذا كانت رسالة العميل تحتوي على الكلمة المفتاحية في أي جزء من الرسالة.
                </li>
                <li>
                  عند تطابق أي كلمة مفتاحية، يتم إرسال الرد المبرمج فوراً وتصفير أي استدعاء للذكاء الاصطناعي للتحكم بمصاريف الاستهلاك ورصيدك.
                </li>
              </ul>
            </div>
          </div>

        </div>
      )}

      {/* --- ADD/EDIT KEYWORD RULE MODAL --- */}
      {ruleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { if (!savingRule) setRuleModalOpen(false); }}
          ></div>
          
          <div className="relative z-10 w-full max-w-md bg-[#0e1622] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden shadow-2xl animate-fade-in text-right">
            {/* Header */}
            <div className="bg-[#0c0f16] px-6 py-4 flex items-center justify-between border-b border-[rgba(255,255,255,0.04)]">
              <button 
                onClick={() => setRuleModalOpen(false)}
                disabled={savingRule}
                className="text-[#607d8b] hover:text-white transition-all bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
              
              <h3 className="text-sm font-bold text-white">
                {editingRule ? 'تعديل قاعدة رد تلقائي' : 'إضافة قاعدة رد تلقائي جديدة'}
              </h3>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveRule} className="p-6 flex flex-col gap-4">
              {ruleError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{ruleError}</span>
                </div>
              )}

              {ruleSuccess && (
                <div className="p-3 rounded-lg bg-[#00ffa7]/10 border border-[#00ffa7]/20 text-[#00ffa7] text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>{ruleSuccess}</span>
                </div>
              )}

              {/* Keyword Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#90a4ae]">الكلمة المفتاحية المستهدفة <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="مثل: الأسعار، موقعنا، السلام عليكم"
                    className="input-premium text-xs"
                    disabled={savingRule}
                    required
                  />
                </div>
              </div>

              {/* Match Type Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#90a4ae]">نوع مطابقة الكلمة</label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value)}
                  className="bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-white rounded-xl px-3 py-2.5 text-xs outline-none transition-all cursor-pointer"
                  disabled={savingRule}
                >
                  <option value="CONTAINS">يحتوي على الكلمة (مثال: "بكم الأسعار" سيشغل الكلمة "الأسعار")</option>
                  <option value="EXACT">تطابق كلي (مثال: الرسالة يجب أن تكون "الأسعار" فقط دون أي كلمة أخرى)</option>
                </select>
              </div>

              {/* Reply Text Textarea */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#90a4ae]">نص الرد التلقائي المرسل للعميل <span className="text-red-500">*</span></label>
                <textarea 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="اكتب الرد التلقائي هنا... يمكنك تضمين روابط أو تفاصيل التواصل."
                  className="input-premium text-xs min-h-[120px] leading-relaxed"
                  disabled={savingRule}
                  required
                />
              </div>

              {/* Enabled Switch */}
              <div className="flex items-center justify-between bg-[#060b11] p-3.5 rounded-xl border border-[rgba(255,255,255,0.04)] mt-1">
                <span className="text-xs font-bold text-[#90a4ae]">تفعيل هذه القاعدة فوراً</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={ruleEnabled} 
                    onChange={(e) => setRuleEnabled(e.target.checked)}
                    className="sr-only peer"
                    disabled={savingRule}
                  />
                  <div className="w-9 h-5 bg-[#162232] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#060b11] after:border-none after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00ffa7] peer-checked:after:bg-[#060b11]"></div>
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center gap-3 justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setRuleModalOpen(false)}
                  disabled={savingRule}
                  className="px-4 py-2.5 rounded-xl border border-[rgba(255,255,255,0.06)] text-xs font-bold text-[#90a4ae] hover:text-white transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingRule}
                  className="btn-primary px-5 py-2.5 text-xs font-bold transition-all cursor-pointer"
                >
                  {savingRule ? 'جاري الحفظ...' : 'حفظ القاعدة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
