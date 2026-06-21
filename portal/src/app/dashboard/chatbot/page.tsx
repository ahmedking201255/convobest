'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bot, 
  Eye, 
  EyeOff, 
  Save, 
  Key, 
  AlertTriangle, 
  Check, 
  Cpu, 
  HelpCircle,
  Activity,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import Link from 'next/link';

export default function ChatbotSettingsPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [loadingInstances, setLoadingInstances] = useState(true);

  // User subscription states
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // AI Config Form States
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState('OPENAI');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiSystemPrompt, setAiSystemPrompt] = useState('');
  const [loadingAiConfig, setLoadingAiConfig] = useState(false);
  const [savingAiConfig, setSavingAiConfig] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiSuccess, setAiSuccess] = useState('');

  // Google Sheets integration state
  const [googleConnected, setGoogleConnected] = useState(false);
  const [useProductsSheet, setUseProductsSheet] = useState(false);
  const [productsSpreadsheetId, setProductsSpreadsheetId] = useState('');
  const [productsSheetName, setProductsSheetName] = useState('');
  const [nameCol, setNameCol] = useState('');
  const [priceCol, setPriceCol] = useState('');
  const [descCol, setDescCol] = useState('');
  const [stockCol, setStockCol] = useState('');

  const [spreadsheets, setSpreadsheets] = useState<any[]>([]);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);
  const [sheets, setSheets] = useState<string[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);

  // Fetch Spreadsheets list from Drive
  const fetchSpreadsheets = useCallback(async (instanceId: string) => {
    setLoadingSpreadsheets(true);
    setSpreadsheets([]);
    try {
      const res = await fetch(`/api/integration/google-sheets/spreadsheets?instanceId=${instanceId}`);
      const data = await res.json();
      if (res.ok && data.spreadsheets) {
        setSpreadsheets(data.spreadsheets);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingSpreadsheets(false);
    }
  }, []);

  // Fetch Sheets (worksheets) in Spreadsheet
  const fetchSheets = useCallback(async (instanceId: string, spreadsheetId: string) => {
    setLoadingSheets(true);
    setSheets([]);
    try {
      const res = await fetch(`/api/integration/google-sheets/sheets?instanceId=${instanceId}&spreadsheetId=${spreadsheetId}`);
      const data = await res.json();
      if (res.ok && data.sheets) {
        setSheets(data.sheets);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSheets(false);
    }
  }, []);

  // Fetch Columns in Worksheet
  const fetchColumns = useCallback(async (instanceId: string, spreadsheetId: string, sheetName: string) => {
    setLoadingColumns(true);
    setColumns([]);
    try {
      const res = await fetch(
        `/api/integration/google-sheets/columns?instanceId=${instanceId}&spreadsheetId=${spreadsheetId}&sheetName=${encodeURIComponent(sheetName)}`
      );
      const data = await res.json();
      if (res.ok && data.columns) {
        setColumns(data.columns);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingColumns(false);
    }
  }, []);

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

  // Fetch AI Chatbot Config
  const fetchAiConfig = useCallback(async (instanceId: string) => {
    setLoadingAiConfig(true);
    setAiError('');
    setAiSuccess('');
    try {
      const res = await fetch(`/api/chatbot/config?instanceId=${instanceId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch chatbot configuration');
      
      const config = data.config;
      setAiEnabled(config.enabled);
      setAiProvider(config.provider || 'OPENAI');
      setAiApiKey(config.apiKey || '');
      setAiSystemPrompt(config.systemPrompt || '');

      // Google Sheets products settings
      setUseProductsSheet(config.useProductsSheet || false);
      setProductsSpreadsheetId(config.productsSpreadsheetId || '');
      setProductsSheetName(config.productsSheetName || '');
      
      if (config.productsMapping) {
        try {
          const mapping = typeof config.productsMapping === 'string'
            ? JSON.parse(config.productsMapping)
            : config.productsMapping;
          setNameCol(mapping.nameCol || '');
          setPriceCol(mapping.priceCol || '');
          setDescCol(mapping.descCol || '');
          setStockCol(mapping.stockCol || '');
        } catch (e) {
          console.error(e);
        }
      } else {
        setNameCol('');
        setPriceCol('');
        setDescCol('');
        setStockCol('');
      }

      // Check Google integration connection
      const sheetsConfigRes = await fetch(`/api/integration/google-sheets/config?instanceId=${instanceId}`);
      const sheetsConfigData = await sheetsConfigRes.json();
      if (sheetsConfigRes.ok && sheetsConfigData.config) {
        setGoogleConnected(sheetsConfigData.config.isConnected);
        if (sheetsConfigData.config.isConnected) {
          fetchSpreadsheets(instanceId);
        }
      } else {
        setGoogleConnected(false);
      }
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setLoadingAiConfig(false);
    }
  }, [fetchSpreadsheets, fetchSpreadsheets]);

  // Trigger data fetch when selected instance changes
  useEffect(() => {
    if (selectedInstanceId) {
      fetchAiConfig(selectedInstanceId);
    }
  }, [selectedInstanceId, fetchAiConfig]);

  // Fetch Sheets list when productsSpreadsheetId changes
  useEffect(() => {
    if (productsSpreadsheetId && selectedInstanceId) {
      fetchSheets(selectedInstanceId, productsSpreadsheetId);
    } else {
      setSheets([]);
      setProductsSheetName('');
    }
  }, [productsSpreadsheetId, selectedInstanceId, fetchSheets]);

  // Fetch Columns when productsSheetName changes
  useEffect(() => {
    if (productsSpreadsheetId && productsSheetName && selectedInstanceId) {
      fetchColumns(selectedInstanceId, productsSpreadsheetId, productsSheetName);
    } else {
      setColumns([]);
    }
  }, [productsSpreadsheetId, productsSheetName, selectedInstanceId, fetchColumns]);

  // Handle saving AI config
  const handleSaveAiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstanceId) return;

    setSavingAiConfig(true);
    setAiError('');
    setAiSuccess('');

    try {
      const res = await fetch('/api/chatbot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          enabled: aiEnabled,
          provider: aiProvider,
          apiKey: aiApiKey,
          systemPrompt: aiSystemPrompt,
          useProductsSheet,
          productsSpreadsheetId: useProductsSheet ? productsSpreadsheetId : null,
          productsSheetName: useProductsSheet ? productsSheetName : null,
          productsMapping: useProductsSheet ? {
            nameCol,
            priceCol,
            descCol,
            stockCol
          } : null
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save chatbot configuration');

      setAiSuccess('تم حفظ إعدادات الشات بوت بنجاح! ستقوم خوادم الويب هوك بالرد التلقائي على الرسائل الواردة فوراً.');
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setSavingAiConfig(false);
    }
  };

  if (loadingInstances || loadingSession) {
    return (
      <div className="h-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ffa7] to-[#00b0ff] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#060b11] animate-spin" />
          </div>
          <span className="text-xs text-[#90a4ae]">جاري تهيئة إعدادات الشات بوت...</span>
        </div>
      </div>
    );
  }

  const currentPlan = session?.subscription?.plan || 'Starter (Trial)';
  const canUseChatbot = currentPlan.toLowerCase().includes('pro') || currentPlan.toLowerCase().includes('enterprise');

  return (
    <div className="flex flex-col gap-8 text-right animate-fade-in relative">
      
      {/* Title */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">شات بوت الذكي بالذكاء الاصطناعي (AI Chatbot)</h1>
        <p className="text-xs text-[#90a4ae] mt-1">قم بتهيئة شات بوت متطور يجيب على عملائك تلقائياً وبشكل طبيعي بالاعتماد على نماذج OpenAI أو Gemini.</p>
      </div>

      {instances.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center text-center py-16 px-6 gap-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="flex flex-col gap-1.5 max-w-md">
            <h3 className="text-lg font-bold text-white">لم تقم بربط أي رقم هاتف متصل حالياً</h3>
            <p className="text-xs text-[#90a4ae] leading-relaxed">
              لتفعيل شات بوت الذكاء الاصطناعي، يجب أولاً ربط رقم هاتف واتساب واحد على الأقل وتفعيل اتصاله بالمسح الضوئي للـ QR.
            </p>
          </div>
          <Link href="/dashboard/instances" className="btn-primary text-xs font-bold py-3 px-6">
            اذهب لربط رقم واتساب بالمسح الضوئي
          </Link>
        </div>
      ) : (
        <>
          {!canUseChatbot ? (
            /* Locked upgrade screen */
            <div className="glass-card flex flex-col items-center justify-center text-center py-16 px-6 gap-6 border-l-4 border-l-orange-500">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="flex flex-col gap-1.5 max-w-md">
                <h3 className="text-lg font-bold text-white">خدمة الشات بوت الذكي غير متاحة في باقتك</h3>
                <p className="text-xs text-[#90a4ae] leading-relaxed">
                  ميزة الشات بوت المدعوم بالذكاء الاصطناعي (AI Chatbot) متوفرة حصرياً لمشتركي الباقات الاحترافية (Pro) والشركات (Enterprise).
                  باقة اشتراكك الحالية ({currentPlan}) لا تدعم هذه الخدمة.
                </p>
              </div>
              <div className="flex gap-4 items-center">
                <Link href="/dashboard/keywords" className="btn-secondary text-xs font-bold py-3.5 px-6">
                  إعداد شات بوت الكلمات المفتاحية 💬
                </Link>
                <Link href="/dashboard/billing" className="btn-primary text-xs font-bold py-3.5 px-6">
                  ترقية باقة الاشتراك الآن ⚡
                </Link>
              </div>
            </div>
          ) : (
            /* Full AI settings form */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Form Column */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                {aiError && (
                  <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <span>{aiError}</span>
                  </div>
                )}

                {aiSuccess && (
                  <div className="p-4 rounded-xl bg-[#00ffa7]/10 border border-[#00ffa7]/20 text-[#00ffa7] text-xs flex items-center gap-2">
                    <Check className="w-5 h-5 flex-shrink-0" />
                    <span>{aiSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleSaveAiConfig} className="glass-card flex flex-col gap-6">
                  {/* Instance Selector */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-[#90a4ae]">اختر رقم الواتساب المربوط</label>
                    <select 
                      value={selectedInstanceId}
                      onChange={(e) => setSelectedInstanceId(e.target.value)}
                      className="input-premium text-sm pr-4 animate-none"
                      disabled={savingAiConfig || loadingAiConfig}
                    >
                      {instances.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {loadingAiConfig ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-3 animate-pulse">
                      <Activity className="w-6 h-6 text-[#00ffa7] animate-spin" />
                      <span className="text-[10px] text-[#607d8b]">جاري جلب إعدادات البوت للرقم المختار...</span>
                    </div>
                  ) : (
                    <>
                      <hr className="border-[rgba(255,255,255,0.04)]" />

                      {/* Enable Toggle Switch */}
                      <div className="flex items-center justify-between bg-[#0c121c] p-4 rounded-xl border border-[rgba(255,255,255,0.03)]">
                        <div className="text-right">
                          <h4 className="text-sm font-bold text-white">تفعيل الرد الآلي بالذكاء الاصطناعي</h4>
                          <p className="text-[10px] text-[#607d8b] mt-0.5">عند تمكينه، سيرد البوت على كافة الرسائل الواردة بشكل تلقائي فوري.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={aiEnabled}
                            onChange={(e) => setAiEnabled(e.target.checked)}
                            className="sr-only peer"
                            disabled={savingAiConfig}
                          />
                          <div className="w-11 h-6 bg-[#162232] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#060b11] after:border-none after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00ffa7] peer-checked:after:bg-[#060b11]"></div>
                        </label>
                      </div>

                      {/* Provider selection (OpenAI vs Gemini) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-[#90a4ae]">مزود الذكاء الاصطناعي (AI Provider)</label>
                          <select 
                            value={aiProvider}
                            onChange={(e) => setAiProvider(e.target.value)}
                            className="input-premium text-xs"
                            disabled={savingAiConfig}
                          >
                            <option value="OPENAI">OpenAI (GPT-4o mini)</option>
                            <option value="GEMINI">Google Gemini (Gemini 1.5 Flash)</option>
                          </select>
                        </div>

                        {/* API Key */}
                        <div className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-[#90a4ae] flex items-center gap-1 justify-end">
                            <span>مفتاح الربط للـ API (API Key)</span>
                            <Key className="w-3.5 h-3.5 text-[#ff9100]" />
                          </label>
                          <div className="relative">
                            <input 
                              type={showAiKey ? 'text' : 'password'}
                              value={aiApiKey}
                              onChange={(e) => setAiApiKey(e.target.value)}
                              placeholder={aiProvider === 'OPENAI' ? 'sk-proj-...' : 'AIzaSy...'}
                              className="input-premium text-xs pl-12 text-left animate-none"
                              style={{ direction: 'ltr', paddingRight: '3rem' }}
                              disabled={savingAiConfig}
                              required={aiEnabled}
                            />
                            <button 
                              type="button"
                              onClick={() => setShowAiKey(!showAiKey)}
                              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#607d8b] hover:text-white p-1 rounded"
                            >
                              {showAiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* System Prompt Instructions */}
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-[#90a4ae] flex items-center gap-1 justify-end">
                          <span>التعليمات وتحديد هوية البوت (System Prompt Instructions)</span>
                          <Cpu className="w-3.5 h-3.5 text-[#00ffa7]" />
                        </label>
                        <textarea 
                          value={aiSystemPrompt}
                          onChange={(e) => setAiSystemPrompt(e.target.value)}
                          placeholder="أنت طبيب عيادة تجميل... أجب العملاء بأسلوب مهذب وبسياق تسويقي."
                          className="input-premium text-xs min-h-[160px] leading-relaxed"
                          disabled={savingAiConfig}
                          required={aiEnabled}
                        />
                      </div>

                      <hr className="border-[rgba(255,255,255,0.04)]" />

                      {/* Google Sheets Integration Section */}
                      <div className="flex flex-col gap-4 bg-[#0a0f18]/40 p-5 rounded-xl border border-[rgba(255,255,255,0.02)]">
                        <div className="flex items-center justify-between">
                          <div className="text-right">
                            <h4 className="text-sm font-bold text-white flex items-center gap-1.5 justify-end">
                              <span>ربط جداول جوجل كقاعدة معرفية للمنتجات</span>
                              <FileSpreadsheet className="w-4 h-4 text-[#00ffa7]" />
                            </h4>
                            <p className="text-[10px] text-[#607d8b] mt-0.5">اسمح للبوت بقراءة أسعار وتفاصيل منتجاتك مباشرة من Google Sheets للرد على استفسارات عملائك.</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={useProductsSheet}
                              onChange={(e) => setUseProductsSheet(e.target.checked)}
                              className="sr-only peer"
                              disabled={savingAiConfig}
                            />
                            <div className="w-11 h-6 bg-[#162232] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#060b11] after:border-none after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00ffa7] peer-checked:after:bg-[#060b11]"></div>
                          </label>
                        </div>

                        {useProductsSheet && (
                          <div className="flex flex-col gap-4 mt-2 border-t border-[rgba(255,255,255,0.04)] pt-4 animate-fade-in">
                            {!googleConnected ? (
                              <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-xs flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                  <span className="font-bold">لم تقم بربط حساب Google Sheets بعد</span>
                                </div>
                                <p className="text-[11px] text-[#b0bec5] leading-relaxed">
                                  يجب عليك أولاً ربط حساب جوجل الخاص بك وتفعيل التكامل لقراءة الجداول.
                                </p>
                                <Link 
                                  href={`/dashboard/google-sheets?instanceId=${selectedInstanceId}`}
                                  className="btn-primary text-center text-[11px] font-bold py-2 px-4 bg-yellow-500 text-black hover:bg-yellow-400 self-start"
                                >
                                  ربط حساب جوجل الآن
                                </Link>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Spreadsheet Selector */}
                                <div className="flex flex-col gap-2">
                                  <label className="text-xs font-bold text-[#90a4ae]">اختر ملف جدول البيانات (Spreadsheet)</label>
                                  {loadingSpreadsheets ? (
                                    <div className="input-premium py-2 text-xs text-[#607d8b] animate-pulse flex items-center justify-center gap-2">
                                      <Activity className="w-3.5 h-3.5 animate-spin text-[#00ffa7]" />
                                      <span>جاري جلب الملفات من جوجل درايف...</span>
                                    </div>
                                  ) : (
                                    <select 
                                      value={productsSpreadsheetId}
                                      onChange={(e) => {
                                        setProductsSpreadsheetId(e.target.value);
                                        setProductsSheetName('');
                                      }}
                                      className="input-premium text-xs pr-4 pr-1"
                                      disabled={savingAiConfig}
                                      required={useProductsSheet}
                                    >
                                      <option value="">-- اختر ملفاً --</option>
                                      {spreadsheets.map((sheet) => (
                                        <option key={sheet.id} value={sheet.id}>
                                          {sheet.name}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>

                                {/* Sheet Name Selector */}
                                <div className="flex flex-col gap-2">
                                  <label className="text-xs font-bold text-[#90a4ae]">اختر ورقة العمل (Worksheet)</label>
                                  {loadingSheets ? (
                                    <div className="input-premium py-2 text-xs text-[#607d8b] animate-pulse flex items-center justify-center gap-2">
                                      <Activity className="w-3.5 h-3.5 animate-spin text-[#00ffa7]" />
                                      <span>جاري جلب أوراق العمل...</span>
                                    </div>
                                  ) : (
                                    <select 
                                      value={productsSheetName}
                                      onChange={(e) => setProductsSheetName(e.target.value)}
                                      className="input-premium text-xs pr-4"
                                      disabled={savingAiConfig || !productsSpreadsheetId}
                                      required={useProductsSheet}
                                    >
                                      <option value="">-- اختر ورقة عمل --</option>
                                      {sheets.map((name) => (
                                        <option key={name} value={name}>
                                          {name}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>

                                {productsSheetName && (
                                  <div className="col-span-1 md:col-span-2 flex flex-col gap-4 border-t border-[rgba(255,255,255,0.03)] pt-4">
                                    <h5 className="text-xs font-bold text-white">مطابقة أعمدة المنتجات (Product Fields Mapping)</h5>
                                    
                                    {loadingColumns ? (
                                      <div className="py-4 flex flex-col items-center justify-center gap-2 animate-pulse">
                                        <Activity className="w-5 h-5 text-[#00ffa7] animate-spin" />
                                        <span className="text-[10px] text-[#607d8b]">جاري قراءة أعمدة الجدول المختار...</span>
                                      </div>
                                    ) : (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Product Name Column */}
                                        <div className="flex flex-col gap-2">
                                          <label className="text-xs text-[#90a4ae]">عمود اسم المنتج (مطلوب)</label>
                                          <select 
                                            value={nameCol}
                                            onChange={(e) => setNameCol(e.target.value)}
                                            className="input-premium text-xs pr-4"
                                            disabled={savingAiConfig}
                                            required={useProductsSheet}
                                          >
                                            <option value="">-- اختر العمود --</option>
                                            {columns.map((col) => (
                                              <option key={col} value={col}>{col}</option>
                                            ))}
                                          </select>
                                        </div>

                                        {/* Product Price Column */}
                                        <div className="flex flex-col gap-2">
                                          <label className="text-xs text-[#90a4ae]">عمود السعر (اختياري)</label>
                                          <select 
                                            value={priceCol}
                                            onChange={(e) => setPriceCol(e.target.value)}
                                            className="input-premium text-xs pr-4"
                                            disabled={savingAiConfig}
                                          >
                                            <option value="">-- اختر العمود (تعطيل) --</option>
                                            {columns.map((col) => (
                                              <option key={col} value={col}>{col}</option>
                                            ))}
                                          </select>
                                        </div>

                                        {/* Product Description Column */}
                                        <div className="flex flex-col gap-2">
                                          <label className="text-xs text-[#90a4ae]">عمود وصف المنتج (اختياري)</label>
                                          <select 
                                            value={descCol}
                                            onChange={(e) => setDescCol(e.target.value)}
                                            className="input-premium text-xs pr-4"
                                            disabled={savingAiConfig}
                                          >
                                            <option value="">-- اختر العمود (تعطيل) --</option>
                                            {columns.map((col) => (
                                              <option key={col} value={col}>{col}</option>
                                            ))}
                                          </select>
                                        </div>

                                        {/* Product Stock Column */}
                                        <div className="flex flex-col gap-2">
                                          <label className="text-xs text-[#90a4ae]">عمود حالة التوفر/الكمية (اختياري)</label>
                                          <select 
                                            value={stockCol}
                                            onChange={(e) => setStockCol(e.target.value)}
                                            className="input-premium text-xs pr-4"
                                            disabled={savingAiConfig}
                                          >
                                            <option value="">-- اختر العمود (تعطيل) --</option>
                                            {columns.map((col) => (
                                              <option key={col} value={col}>{col}</option>
                                            ))}
                                          </select>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <hr className="border-[rgba(255,255,255,0.04)]" />

                      {/* Submit Save changes */}
                      <button 
                        type="submit"
                        className="btn-primary py-3.5 font-bold text-xs justify-center"
                        disabled={savingAiConfig}
                      >
                        {savingAiConfig ? (
                          <span>جاري حفظ البيانات وتحديث خادم الويب هوك...</span>
                        ) : (
                          <>
                            <span>حفظ إعدادات البوت والتشغيل</span>
                            <Save className="w-4 h-4 ml-1" />
                          </>
                        )}
                      </button>
                    </>
                  )}
                </form>
              </div>

              {/* Instructions Column */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="glass-card flex flex-col gap-4 border-l-4 border-l-[#00ffa7]">
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5 justify-end">
                    <span>كيف يعمل الشات بوت؟</span>
                    <HelpCircle className="w-4 h-4 text-[#00ffa7]" />
                  </h3>
                  <hr className="border-[rgba(255,255,255,0.04)]" />
                  <ul className="flex flex-col gap-3 text-xs text-[#90a4ae] leading-relaxed list-disc pr-4 text-right">
                    <li>
                      عند استقبال رقم الواتساب المربوط لأي رسالة جديدة من عملائك، يقوم النظام بمعالجة الرسالة وتجهيز الرد تلقائياً.
                    </li>
                    <li>
                      يتم تحليل محتوى الرسالة وتوجيهها إلى الذكاء الاصطناعي استناداً إلى التعليمات التي قمت بضبطها في هذا النموذج (System Prompt).
                    </li>
                    <li>
                      يتم استخدام مفتاح الربط الـ API الخاص بك مباشرة (مثل OpenAI أو Gemini) لضمان مرونة استهلاك رصيدك المباشر والتحكم الكامل بالتكلفة.
                    </li>
                    <li>
                      يرد البوت فورياً بأسلوب طبيعي وذكي على العميل، ويتم توثيق كافة المحادثات والردود في **سجل الرسائل** للرجوع إليها.
                    </li>
                  </ul>
                </div>
              </div>

            </div>
          )}
        </>
      )}

    </div>
  );
}
