'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  Check, 
  X, 
  FileSpreadsheet, 
  Copy, 
  RefreshCw, 
  Info, 
  Play,
  Settings,
  Link2,
  Link2Off,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';

function planIncludesGoogleSheets(plan?: string | null) {
  const normalizedPlan = (plan || '').toLowerCase();
  return normalizedPlan.includes('pro') || normalizedPlan.includes('enterprise');
}

export default function GoogleSheetsPage() {
  const portalOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [loadingInstances, setLoadingInstances] = useState(true);

  // User session
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Google Sheets config state
  const [config, setConfig] = useState<any>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // OAuth status from URL query
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('oauth') === 'success') {
        setSuccess('تم ربط حساب جوجل بنجاح!');
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname + '?instanceId=' + (params.get('instanceId') || ''));
      }
      const err = params.get('error');
      if (err) {
        setError(`حدث خطأ أثناء مصادقة جوجل: ${decodeURIComponent(err)}`);
        window.history.replaceState({}, document.title, window.location.pathname + '?instanceId=' + (params.get('instanceId') || ''));
      }
    }
  }, []);

  // Google Drive & Sheets browsing state
  const [spreadsheets, setSpreadsheets] = useState<any[]>([]);
  const [loadingSpreadsheets, setLoadingSpreadsheets] = useState(false);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState('');
  
  const [sheets, setSheets] = useState<string[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [selectedSheetName, setSelectedSheetName] = useState('');

  const [columns, setColumns] = useState<string[]>([]);
  const [sampleRow, setSampleRow] = useState<Record<string, string>>({});
  const [loadingColumns, setLoadingColumns] = useState(false);

  // Mappings Form States
  const [enabled, setEnabled] = useState(false);
  const [phoneColumn, setPhoneColumn] = useState('');
  const [nameColumn, setNameColumn] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('مرحباً {customer_name}، نود تذكيرك بالبيانات التالية...');
  const [campaignName, setCampaignName] = useState('حملة جوجل شيتس');
  const [delayMin, setDelayMin] = useState(5);
  const [delayMax, setDelayMax] = useState(15);
  
  // Custom placeholders mapping state
  const [customVarsMapping, setCustomVarsMapping] = useState<Record<string, string>>({});

  // Parse custom placeholders from template (excluding {customer_name})
  const detectedPlaceholders = useMemo(() => {
    const regex = /\{[^{}]+\}/g;
    const matches = messageTemplate.match(regex) || [];
    const unique = Array.from(new Set(matches));
    return unique.filter(placeholder => placeholder !== '{customer_name}');
  }, [messageTemplate]);

  // Update custom variable mapping state when placeholders or columns change
  useEffect(() => {
    const updated = { ...customVarsMapping };
    let changed = false;

    // Remove obsolete placeholders
    Object.keys(updated).forEach(key => {
      if (!detectedPlaceholders.includes(key)) {
        delete updated[key];
        changed = true;
      }
    });

    // Add new placeholders with default empty mapping
    detectedPlaceholders.forEach(placeholder => {
      if (updated[placeholder] === undefined) {
        updated[placeholder] = columns.includes(placeholder.replace(/[{}]/g, ''))
          ? placeholder.replace(/[{}]/g, '')
          : '';
        changed = true;
      }
    });

    if (changed) {
      setCustomVarsMapping(updated);
    }
  }, [detectedPlaceholders, columns, customVarsMapping]);

  // Copy code block indicator
  const [copiedCode, setCopiedCode] = useState(false);

  // Fetch Session and Connected Instances
  useEffect(() => {
    async function fetchSessionAndInstances() {
      try {
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json();
        if (sessionRes.ok && sessionData.authenticated) {
          setSession(sessionData.user);
          if (!planIncludesGoogleSheets(sessionData.user.subscription?.plan)) {
            return;
          }
        }

        const res = await fetch('/api/instances');
        const data = await res.json();
        if (res.ok && Array.isArray(data)) {
          const connectedOnly = data.filter((inst: any) => inst.status === 'CONNECTED');
          setInstances(connectedOnly);
          
          // Try to get instanceId from URL first
          const params = new URLSearchParams(window.location.search);
          const urlInstanceId = params.get('instanceId');
          
          if (urlInstanceId && connectedOnly.some(i => i.id === urlInstanceId)) {
            setSelectedInstanceId(urlInstanceId);
          } else if (connectedOnly.length > 0) {
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

  // Fetch Spreadsheets list from Drive
  const fetchSpreadsheets = useCallback(async (instanceId: string) => {
    setLoadingSpreadsheets(true);
    setSpreadsheets([]);
    setError('');
    try {
      const res = await fetch(`/api/integration/google-sheets/spreadsheets?instanceId=${instanceId}`);
      const data = await res.json();
      if (res.ok && data.spreadsheets) {
        setSpreadsheets(data.spreadsheets);
      } else {
        if (!data.isOAuthError) {
          setError(data.error || 'فشل جلب الملفات من جوجل درايف');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('حدث خطأ في الاتصال أثناء جلب الملفات');
    } finally {
      setLoadingSpreadsheets(false);
    }
  }, []);

  // Fetch Google Sheets Config for Instance
  const fetchConfig = useCallback(async (instanceId: string) => {
    setLoadingConfig(true);
    setError('');
    try {
      const res = await fetch(`/api/integration/google-sheets/config?instanceId=${instanceId}`);
      const data = await res.json();
      if (res.ok && data.config) {
        setConfig(data.config);
        setEnabled(data.config.enabled);
        
        if (data.config.isConnected) {
          // If connected, fetch spreadsheets list
          fetchSpreadsheets(instanceId);
          
          // Restore selected file state if exists
          if (data.config.spreadsheetId) {
            setSelectedSpreadsheetId(data.config.spreadsheetId);
            setSelectedSheetName(data.config.sheetName || '');
            
            // Parse saved mappings if present
            if (data.config.columnMapping) {
              try {
                const parsed = JSON.parse(data.config.columnMapping);
                setPhoneColumn(parsed.phone || '');
                setNameColumn(parsed.name || '');
                if (parsed.vars) {
                  setCustomVarsMapping(parsed.vars);
                }
              } catch (e) {
                console.error('Failed to parse columnMapping JSON', e);
              }
            }
          }
        }
      } else {
        setError(data.error || 'فشل تحميل إعدادات جوجل شيتس');
      }
    } catch (err: any) {
      console.error(err);
      setError('حدث خطأ أثناء الاتصال بالخادم');
    } finally {
      setLoadingConfig(false);
    }
  }, [fetchSpreadsheets]);

  // Trigger config fetch on instance change
  useEffect(() => {
    if (selectedInstanceId) {
      fetchConfig(selectedInstanceId);
      // Update URL query param quietly
      const url = new URL(window.location.href);
      url.searchParams.set('instanceId', selectedInstanceId);
      window.history.replaceState({}, '', url.pathname + url.search);
    }
  }, [selectedInstanceId, fetchConfig]);

  // Fetch sheets inside the selected spreadsheet
  useEffect(() => {
    if (!selectedSpreadsheetId || !selectedInstanceId) {
      setSheets([]);
      setSelectedSheetName('');
      return;
    }

    async function fetchSheets() {
      setLoadingSheets(true);
      setError('');
      try {
        const res = await fetch(`/api/integration/google-sheets/sheets?instanceId=${selectedInstanceId}&spreadsheetId=${selectedSpreadsheetId}`);
        const data = await res.json();
        if (res.ok && data.sheets) {
          setSheets(data.sheets);
          if (data.sheets.length > 0 && !data.sheets.includes(selectedSheetName)) {
            setSelectedSheetName(data.sheets[0]);
          }
        } else {
          setError(data.error || 'فشل تحميل أوراق العمل من الملف');
        }
      } catch (e) {
        setError('حدث خطأ في تحميل أوراق العمل');
      } finally {
        setLoadingSheets(false);
      }
    }
    fetchSheets();
  }, [selectedSpreadsheetId, selectedInstanceId]);

  // Fetch columns from the selected sheet
  useEffect(() => {
    if (!selectedSpreadsheetId || !selectedSheetName || !selectedInstanceId) {
      setColumns([]);
      setSampleRow({});
      return;
    }

    async function fetchColumns() {
      setLoadingColumns(true);
      setError('');
      try {
        const res = await fetch(
          `/api/integration/google-sheets/columns?instanceId=${selectedInstanceId}&spreadsheetId=${selectedSpreadsheetId}&sheetName=${encodeURIComponent(selectedSheetName)}`
        );
        const data = await res.json();
        if (res.ok && data.columns) {
          setColumns(data.columns);
          setSampleRow(data.sample || {});
          
          // Auto select first match if mapping not set
          if (!phoneColumn && data.columns.length > 0) {
            const phoneMatch = data.columns.find((c: string) => c.includes('هاتف') || c.includes('جوال') || c.includes('رقم') || c.toLowerCase().includes('phone') || c.toLowerCase().includes('mobile'));
            if (phoneMatch) setPhoneColumn(phoneMatch);
          }
          if (!nameColumn && data.columns.length > 0) {
            const nameMatch = data.columns.find((c: string) => c.includes('اسم') || c.toLowerCase().includes('name'));
            if (nameMatch) setNameColumn(nameMatch);
          }
        } else {
          setError(data.error || 'فشل قراءة أعمدة جدول البيانات');
        }
      } catch (e) {
        setError('حدث خطأ أثناء تحميل أعمدة الجدول');
      } finally {
        setLoadingColumns(false);
      }
    }
    fetchColumns();
  }, [selectedSpreadsheetId, selectedSheetName, selectedInstanceId]);

  // Handle Google Auth connection redirect
  const handleConnectGoogle = async () => {
    if (!selectedInstanceId) return;
    setError('');
    try {
      const res = await fetch(`/api/integration/google-sheets/oauth?instanceId=${selectedInstanceId}`);
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'فشل بدء مصادقة جوجل شيتس');
      }
    } catch (e) {
      setError('حدث خطأ في الشبكة أثناء الاتصال بجوجل');
    }
  };

  // Handle Disconnecting Google Account
  const handleDisconnectGoogle = async () => {
    if (!selectedInstanceId || savingConfig) return;
    if (!confirm('هل أنت متأكد من رغبتك في إلغاء ربط حساب جوجل؟ ستتوقف أي حملات مجدولة معلقة من جوجل شيتس.')) return;

    setSavingConfig(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/integration/google-sheets/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          disconnect: true
        })
      });
      const data = await res.json();
      if (res.ok) {
        setConfig(data.config);
        setEnabled(false);
        setSpreadsheets([]);
        setSelectedSpreadsheetId('');
        setSheets([]);
        setSelectedSheetName('');
        setColumns([]);
        setSuccess('تم إلغاء ربط حساب جوجل بنجاح.');
      } else {
        setError(data.error || 'فشل إلغاء ربط الحساب');
      }
    } catch (e) {
      setError('حدث خطأ أثناء إرسال طلب إلغاء الربط');
    } finally {
      setSavingConfig(false);
    }
  };

  // Launch Campaign (POST to sync)
  const handleLaunchCampaign = async () => {
    if (!selectedInstanceId || syncing) return;
    if (!selectedSpreadsheetId || !selectedSheetName) {
      setError('يرجى اختيار ملف جوجل شيت والورقة المطلوبة أولاً');
      return;
    }
    if (!phoneColumn) {
      setError('عمود أرقام الهواتف مطلوب للإرسال');
      return;
    }
    if (!campaignName.trim()) {
      setError('اسم الحملة مطلوب لتنظيم السجلات');
      return;
    }

    setSyncing(true);
    setError('');
    setSuccess('');

    // Construct mapping
    const columnMapping = {
      phone: phoneColumn,
      name: nameColumn || null,
      vars: customVarsMapping
    };

    const spreadsheetName = spreadsheets.find(s => s.id === selectedSpreadsheetId)?.name || selectedSpreadsheetId;

    try {
      const res = await fetch('/api/integration/google-sheets/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          spreadsheetId: selectedSpreadsheetId,
          spreadsheetName,
          sheetName: selectedSheetName,
          messageTemplate,
          columnMapping,
          campaignName,
          delayMin,
          delayMax
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إطلاق الحملة');

      setSuccess(`تم بنجاح استيراد ${data.count} صف، وبدأت الحملة "${campaignName}" بالخلفية!`);
      
      // Auto redirect to campaigns log page after 3 seconds
      setTimeout(() => {
        setSuccess('');
      }, 5000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  // Selected instance object
  const currentInstance = instances.find(i => i.id === selectedInstanceId);

  // Generate copyable Apps Script code block
  const appsScriptCode = useMemo(() => {
    const token = currentInstance?.token || 'TOKEN_HERE';
    
    return `// ==========================================
// كود إضافة إرسال رسائل الواتساب - ConvoBest
// ==========================================
// تعليمات الاستخدام:
// 1. افتح جدول بيانات جوجل الخاص بك.
// 2. اذهب إلى Extensions (الإضافات) -> Apps Script.
// 3. احذف أي كود موجود، ثم الصق هذا الكود بالكامل.
// 4. اضغط على زر حفظ (أيقونة القرص المرن).
// 5. اعد تحديث صفحة جوجل شيتس، وسيظهر لك خيار "ConvoBest WhatsApp" في الشريط العلوي!

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('ConvoBest WhatsApp')
    .addItem('إرسال حملة واتساب 🚀', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  var htmlString = \`
    <div style="font-family: Arial, sans-serif; padding: 15px; direction: rtl; text-align: right; background-color: #060b11; color: white; min-height: 100vh;">
      <h3 style="margin-top: 0; color: #00ffa7; border-bottom: 1px solid rgba(255,255,255,0.1); pb: 8px;">إرسال عبر ConvoBest</h3>
      
      <label style="font-size: 10px; color: #90a4ae; display: block; margin-top: 10px;">رمز التوكن (Token API):</label>
      <input type="text" id="apiKey" value="${token}" style="width: 100%; padding: 8px; margin-top: 4px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; background-color: #0c1420; color: white; font-family: monospace; font-size: 11px; box-sizing: border-box;" />
      
      <label style="font-size: 10px; color: #90a4ae; display: block; margin-top: 10px;">اسم الحملة:</label>
      <input type="text" id="campaignName" value="حملة شيتس المباشرة" style="width: 100%; padding: 8px; margin-top: 4px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; background-color: #0c1420; color: white; box-sizing: border-box; font-size: 12px;" />
      
      <label style="font-size: 10px; color: #90a4ae; display: block; margin-top: 10px;">قالب الرسالة (ادخل الأقواس المتطابقة مع الأعمدة):</label>
      <textarea id="template" rows="5" style="width: 100%; padding: 8px; margin-top: 4px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; background-color: #0c1420; color: white; box-sizing: border-box; font-size: 12px; resize: vertical;">مرحباً {الاسم}، نود تذكيرك بالموعد {اليوم} وقيمة الفاتورة {المبلغ}.</textarea>
      
      <label style="font-size: 10px; color: #90a4ae; display: block; margin-top: 10px;">اسم عمود أرقام الهواتف:</label>
      <input type="text" id="phoneCol" value="الهاتف" style="width: 100%; padding: 8px; margin-top: 4px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; background-color: #0c1420; color: white; box-sizing: border-box; font-size: 12px;" />
      
      <label style="font-size: 10px; color: #90a4ae; display: block; margin-top: 10px;">اسم عمود الأسماء (اختياري):</label>
      <input type="text" id="nameCol" value="الاسم" style="width: 100%; padding: 8px; margin-top: 4px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; background-color: #0c1420; color: white; box-sizing: border-box; font-size: 12px;" />
      
      <button onclick="sendData()" id="sendBtn" style="width: 100%; padding: 12px; background-color: #00ffa7; color: #060b11; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 15px; font-size: 12px; transition: all 0.2s;">إطلاق حملة الإرسال 🚀</button>
      
      <div id="status" style="margin-top: 12px; font-size: 11px; padding: 10px; border-radius: 6px; background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); display: none; text-align: center; word-break: break-all;"></div>
      
      <script>
        function sendData() {
          var apiKey = document.getElementById('apiKey').value;
          var campaignName = document.getElementById('campaignName').value;
          var template = document.getElementById('template').value;
          var phoneCol = document.getElementById('phoneCol').value;
          var nameCol = document.getElementById('nameCol').value;
          var btn = document.getElementById('sendBtn');
          var status = document.getElementById('status');
          
          if(!apiKey || !template || !phoneCol) {
            status.style.display = 'block';
            status.style.color = '#ff5252';
            status.innerText = 'يرجى تعبئة الحقول المطلوبة (التوكن، القالب، عمود الهاتف)';
            return;
          }
          
          btn.disabled = true;
          btn.innerText = 'جاري المعالجة...';
          status.style.display = 'block';
          status.style.color = '#00b0ff';
          status.innerText = 'جاري تحليل خلايا الجدول وتجهيز الحملة...';
          
          google.script.run
            .withSuccessHandler(function(res) {
              btn.disabled = false;
              btn.innerText = 'إطلاق حملة الإرسال 🚀';
              status.style.color = '#00ffa7';
              status.innerText = res;
            })
            .withFailureHandler(function(err) {
              btn.disabled = false;
              btn.innerText = 'إطلاق حملة الإرسال 🚀';
              status.style.color = '#ff5252';
              status.innerText = 'حدث خطأ: ' + err;
            })
            .processSend(apiKey, campaignName, template, phoneCol, nameCol);
        }
      <\/script>
    </div>
  \`;
  var html = HtmlService.createHtmlOutput(htmlString).setTitle('ConvoBest WhatsApp Sender');
  SpreadsheetApp.getUi().showSidebar(html);
}

function processSend(apiKey, campaignName, template, phoneCol, nameCol) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    throw new Error('لا توجد بيانات كافية في ورقة العمل النشطة.');
  }
  
  var headers = data[0];
  var rows = data.slice(1);
  
  // Parse variables mapping from template
  var vars = {};
  var matches = template.match(/\\{[^{}]+\\}/g) || [];
  matches.forEach(function(placeholder) {
    var cleanPlaceholder = placeholder.replace(/[{}]/g, '');
    if (cleanPlaceholder !== 'customer_name') {
      vars[placeholder] = cleanPlaceholder;
    }
  });
  
  var payload = {
    campaignName: campaignName,
    messageTemplate: template,
    columnMapping: {
      phone: phoneCol,
      name: nameCol || null,
      vars: vars
    },
    headers: headers,
    rows: rows,
    delayMin: 5,
    delayMax: 15
  };
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  var url = '${portalOrigin}/api/integration/google-sheets/apps-script';
  var response = UrlFetchApp.fetch(url, options);
  var responseText = response.getContentText();
  
  try {
    var resData = JSON.parse(responseText);
    if (response.getResponseCode() === 200) {
      return 'تم بنجاح! ' + resData.message + ' (تم استيراد ' + resData.count + ' رقم)';
    } else {
      throw new Error(resData.error || responseText);
    }
  } catch (e) {
    throw new Error('فشل إرسال الطلب: ' + e.message);
  }
}
`;
  }, [currentInstance, portalOrigin]);

  const copyAppsScript = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const currentPlan = session?.subscription?.plan || 'Starter (Trial)';
  const canUseGoogleSheets = planIncludesGoogleSheets(currentPlan);

  if (loadingInstances || loadingSession) {
    return (
      <div className="h-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ffa7] to-[#00b0ff] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#060b11] animate-spin" />
          </div>
          <span className="text-xs text-[#90a4ae]">جاري تحميل لوحة تكامُل جداول جوجل...</span>
        </div>
      </div>
    );
  }

  if (!canUseGoogleSheets) {
    return (
      <div className="flex flex-col gap-8 text-right animate-fade-in relative" dir="rtl">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#00ffa7]" />
            <span>ربط وتكامل جداول جوجل (Google Sheets)</span>
          </h1>
          <p className="text-[10px] text-[#90a4ae] mt-1">
            حول بيانات العملاء في جداولك إلى حملات واتساب مخصصة وقابلة للقياس.
          </p>
        </div>

        <div className="glass-card flex flex-col items-center justify-center text-center py-16 px-6 gap-6 border-l-4 border-l-orange-500">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="flex flex-col gap-2 max-w-xl">
            <h3 className="text-lg font-bold text-white">تكامل Google Sheets يحتاج ترقية إلى Pro</h3>
            <p className="text-xs text-[#90a4ae] leading-relaxed">
              باقتك الحالية {currentPlan} لا تشمل ربط جداول جوجل. بالترقية إلى Pro أو Enterprise يمكنك استيراد بيانات العملاء، تخصيص الرسائل تلقائيا، وإطلاق الحملات مباشرة من Google Sheets.
            </p>
          </div>
          <Link href="/dashboard/billing" className="btn-primary text-xs font-bold py-3.5 px-6">
            استعرض الباقات وقم بالترقية
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 text-right animate-fade-in relative" dir="rtl">
      
      {/* Top Header Block */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#00ffa7]" />
            <span>ربط وتكامل جداول جوجل (Google Sheets)</span>
          </h1>
          <p className="text-[10px] text-[#90a4ae] mt-1">
            ارسل حملات مخصصة بمتغيرات فريدة لكل عميل مباشرة من ملفات جوجل شيتس.
          </p>
        </div>

        {instances.length > 0 && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto">
            <label className="text-[10px] font-bold text-[#90a4ae] whitespace-nowrap">الرقم المربوط النشط:</label>
            <select 
              value={selectedInstanceId}
              onChange={(e) => {
                setSelectedInstanceId(e.target.value);
                setSelectedSpreadsheetId('');
                setSelectedSheetName('');
                setColumns([]);
              }}
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
              لتفعيل ربط جداول جوجل، يجب أولاً ربط رقم هاتف واتساب واحد على الأقل وتفعيل اتصاله بالمسح الضوئي للـ QR.
            </p>
          </div>
          <Link href="/dashboard/instances" className="btn-primary text-xs font-bold py-3 px-6">
            اذهب لربط رقم واتساب بالمسح الضوئي
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main workspace (left column) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Success and error feedback */}
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

            {/* Google OAuth Connection block */}
            <div className="glass-card flex flex-col gap-5">
              <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.04)] pb-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">مصادقة وتكامل حساب جوجل (OAuth 2.0)</h3>
                  <p className="text-[10px] text-[#607d8b]">اربط حساب جوجل درايف الخاص بك لتصفح واستيراد جداول البيانات مباشرة.</p>
                </div>
                {config?.isConnected ? (
                  <span className="text-[10px] text-[#00ffa7] bg-[#00ffa7]/10 px-3 py-1 rounded-full font-bold">متصل نشط ✅</span>
                ) : (
                  <span className="text-[10px] text-orange-400 bg-orange-400/10 px-3 py-1 rounded-full font-bold">غير متصل ❌</span>
                )}
              </div>

              {loadingConfig ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2">
                  <Activity className="w-5 h-5 text-[#00ffa7] animate-spin" />
                  <span className="text-[9px] text-[#607d8b]">جاري قراءة حالة الاتصال...</span>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {config?.isConnected ? (
                    <button
                      onClick={handleDisconnectGoogle}
                      disabled={savingConfig}
                      className="btn-secondary py-3 px-6 rounded-xl text-xs font-bold text-red-400 hover:text-red-500 hover:bg-red-500/5 hover:border-red-500/20 flex items-center gap-2 cursor-pointer"
                    >
                      <Link2Off className="w-4 h-4" />
                      <span>إلغاء ربط حساب جوجل</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleConnectGoogle}
                      className="btn-primary py-3.5 px-6 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <Link2 className="w-4 h-4" />
                      <span>ربط وتخويل حساب جوجل شيتس</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Configured Google Sheets Settings Form (If connected) */}
            {config?.isConnected && (
              <div className="glass-card flex flex-col gap-6">
                <h3 className="text-sm font-bold text-white border-b border-[rgba(255,255,255,0.04)] pb-3 flex items-center gap-2">
                  <Settings className="w-4.5 h-4.5 text-[#00ffa7]" />
                  <span>تكوين الحملة وجدول البيانات</span>
                </h3>

                {/* 1. File Selection dropdowns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Select Spreadsheet */}
                  <div className="flex flex-col gap-1.5 text-right">
                    <label className="text-[10px] font-bold text-[#90a4ae] flex items-center justify-between">
                      <span>1. اختر ملف جدول البيانات (Spreadsheet)</span>
                      {loadingSpreadsheets && <Activity className="w-3.5 h-3.5 text-[#00ffa7] animate-spin" />}
                    </label>
                    <select
                      value={selectedSpreadsheetId}
                      onChange={(e) => {
                        setSelectedSpreadsheetId(e.target.value);
                        setSelectedSheetName('');
                        setColumns([]);
                      }}
                      className="bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-white rounded-xl px-3 py-2.5 text-xs outline-none transition-all cursor-pointer w-full"
                    >
                      <option value="">-- اختر ملف جوجل شيتس --</option>
                      {spreadsheets.map((sheet) => (
                        <option key={sheet.id} value={sheet.id}>
                          {sheet.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Select Worksheet/Sheet */}
                  <div className="flex flex-col gap-1.5 text-right">
                    <label className="text-[10px] font-bold text-[#90a4ae] flex items-center justify-between">
                      <span>2. اختر ورقة العمل (Worksheet)</span>
                      {loadingSheets && <Activity className="w-3.5 h-3.5 text-[#00ffa7] animate-spin" />}
                    </label>
                    <select
                      value={selectedSheetName}
                      disabled={!selectedSpreadsheetId}
                      onChange={(e) => {
                        setSelectedSheetName(e.target.value);
                        setColumns([]);
                      }}
                      className="bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-white rounded-xl px-3 py-2.5 text-xs outline-none transition-all cursor-pointer w-full disabled:opacity-50"
                    >
                      <option value="">-- اختر ورقة العمل --</option>
                      {sheets.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Loading columns indicator */}
                {loadingColumns && (
                  <div className="py-6 flex flex-col items-center justify-center gap-1.5">
                    <Activity className="w-4 h-4 text-[#00ffa7] animate-spin" />
                    <span className="text-[9px] text-[#607d8b]">جاري مسح الأعمدة والبيانات...</span>
                  </div>
                )}

                {/* Columns Mapping Section (When columns loaded) */}
                {columns.length > 0 && (
                  <div className="flex flex-col gap-5 bg-[#070c14]/40 border border-[rgba(255,255,255,0.03)] p-4 rounded-xl">
                    <h4 className="text-xs font-bold text-white border-b border-[rgba(255,255,255,0.04)] pb-2">3. مطابقة أعمدة جدول البيانات</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Phone Column selection */}
                      <div className="flex flex-col gap-1.5 text-right">
                        <label className="text-[10px] font-bold text-[#90a4ae] flex items-center gap-1">
                          <span className="text-red-500">*</span>
                          <span>عمود أرقام الهواتف:</span>
                        </label>
                        <select
                          value={phoneColumn}
                          onChange={(e) => setPhoneColumn(e.target.value)}
                          className="bg-[#060b11] border border-[rgba(255,255,255,0.06)] text-white rounded-xl px-3 py-2.5 text-xs outline-none w-full"
                        >
                          <option value="">-- اختر عمود الهاتف --</option>
                          {columns.map((c) => (
                            <option key={c} value={c}>
                              {c} {sampleRow[c] ? `(عينة: ${sampleRow[c]})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Name Column selection */}
                      <div className="flex flex-col gap-1.5 text-right">
                        <label className="text-[10px] font-bold text-[#90a4ae]">عمود اسم العميل (اختياري - يطابق `{`{customer_name}`}`):</label>
                        <select
                          value={nameColumn}
                          onChange={(e) => setNameColumn(e.target.value)}
                          className="bg-[#060b11] border border-[rgba(255,255,255,0.06)] text-white rounded-xl px-3 py-2.5 text-xs outline-none w-full"
                        >
                          <option value="">-- بدون اسم (فارغ) --</option>
                          {columns.map((c) => (
                            <option key={c} value={c}>
                              {c} {sampleRow[c] ? `(عينة: ${sampleRow[c]})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Template Input Block */}
                    <div className="flex flex-col gap-1.5 mt-2">
                      <label className="text-[10px] font-bold text-[#90a4ae]">4. صياغة قالب رسالة الواتساب:</label>
                      <textarea
                        value={messageTemplate}
                        onChange={(e) => setMessageTemplate(e.target.value)}
                        rows={4}
                        className="w-full bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-xs text-white rounded-xl px-4 py-3 outline-none resize-none transition-all font-sans"
                        placeholder="اكتب قالب رسالتك هنا..."
                      />
                    </div>

                    {/* Dynamic variables matching from template */}
                    {detectedPlaceholders.length > 0 && (
                      <div className="flex flex-col gap-3.5 border-t border-[rgba(255,255,255,0.04)] pt-3.5 mt-2">
                        <span className="text-[10px] font-bold text-[#00ffa7]">مطابقة المتغيرات الديناميكية المكتشفة في القالب:</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {detectedPlaceholders.map((placeholder) => (
                            <div key={placeholder} className="flex flex-col gap-1.5 text-right">
                              <label className="text-[10px] font-bold text-white/70">المتغير <code>{placeholder}</code> يطابق العمود:</label>
                              <select
                                value={customVarsMapping[placeholder] || ''}
                                onChange={(e) => {
                                  setCustomVarsMapping({
                                    ...customVarsMapping,
                                    [placeholder]: e.target.value
                                  });
                                }}
                                className="bg-[#060b11] border border-[rgba(255,255,255,0.06)] text-white rounded-xl px-3 py-2 text-xs outline-none w-full font-mono"
                              >
                                <option value="">-- اختر العمود المقابل --</option>
                                {columns.map((col) => (
                                  <option key={col} value={col}>
                                    {col} {sampleRow[col] ? `(عينة: ${sampleRow[col]})` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Campaign Configuration (delay and names) */}
                {columns.length > 0 && (
                  <div className="flex flex-col gap-5 border-t border-[rgba(255,255,255,0.04)] pt-5">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Campaign Name */}
                      <div className="flex flex-col gap-1.5 text-right">
                        <label className="text-[10px] font-bold text-[#90a4ae]">اسم حملة الإرسال:</label>
                        <input
                          type="text"
                          value={campaignName}
                          onChange={(e) => setCampaignName(e.target.value)}
                          className="bg-[#060b11] border border-[rgba(255,255,255,0.06)] text-white rounded-xl px-4 py-2.5 text-xs outline-none w-full"
                          placeholder="مثال: تذكير العملاء بـ..."
                        />
                      </div>

                      {/* Speed / Delay settings */}
                      <div className="flex flex-col gap-1.5 text-right">
                        <label className="text-[10px] font-bold text-[#90a4ae] flex justify-between">
                          <span>تأخير الإرسال العشوائي (ثانية):</span>
                          <span className="text-[#00ffa7] font-bold">{delayMin} - {delayMax} ثانية</span>
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="range"
                            min="2"
                            max="30"
                            value={delayMin}
                            onChange={(e) => setDelayMin(Number(e.target.value))}
                            className="flex-1 accent-[#00ffa7]"
                          />
                          <input
                            type="range"
                            min="31"
                            max="120"
                            value={delayMax}
                            onChange={(e) => setDelayMax(Number(e.target.value))}
                            className="flex-1 accent-[#00ffa7]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Launch Campaign Button */}
                    <button
                      onClick={handleLaunchCampaign}
                      disabled={syncing || !phoneColumn}
                      className="btn-primary py-3.5 px-6 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 self-start cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 mt-2"
                    >
                      {syncing ? (
                        <>
                          <Activity className="w-4 h-4 animate-spin" />
                          <span>جاري سحب شيتس وبدء الإرسال...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-[#060b11]" />
                          <span>إطلاق حملة الإرسال من جوجل شيتس</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column instructions / Apps Script Box */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Apps Script Card */}
            <div className="glass-card flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-[rgba(255,255,255,0.04)] pb-2 flex-row-reverse justify-end">
                <FileSpreadsheet className="w-4.5 h-4.5 text-[#00ffa7]" />
                <span>إضافة Apps Script المباشرة</span>
              </h3>
              <p className="text-[10px] text-[#90a4ae] leading-relaxed">
                تريد الإرسال بنقرة زر واحدة من داخل ملف Excel/Sheets بدون فتح لوحة التحكم؟
                انسخ هذا الكود والصقه في محرر البرمجة المدمج بجوجل شيتس الخاص بك لتظهر لك قائمة الإرسال فوراً!
              </p>

              <button
                onClick={copyAppsScript}
                className="btn-secondary py-3 text-xs font-bold text-center flex items-center justify-center gap-2 rounded-xl hover:bg-[#00ffa7]/5 hover:border-[#00ffa7]/20 hover:text-white transition-all cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4 text-[#00ffa7]" />
                    <span>تم النسخ!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[#00ffa7]" />
                    <span>نسخ كود Apps Script</span>
                  </>
                )}
              </button>

              <div className="relative mt-2">
                <textarea
                  readOnly
                  value={appsScriptCode}
                  className="w-full bg-[#060b11] border border-[rgba(255,255,255,0.06)] rounded-xl p-3 text-[8.5px] text-[#90a4ae] font-mono h-40 outline-none select-all resize-none text-left"
                />
              </div>
            </div>

            {/* Instruction Steps */}
            <div className="glass-card flex flex-col gap-4">
              <h3 className="text-sm font-bold text-white border-b border-[rgba(255,255,255,0.04)] pb-2">كيفية إعداد Apps Script:</h3>
              <ol className="text-[10px] text-[#90a4ae] leading-relaxed flex flex-col gap-3.5 list-decimal list-inside pr-1">
                <li>
                  <strong className="text-white">انسخ الكود</strong>: اضغط على زر النسخ بالأعلى للحصول على الكود البرمجي المخصص لرقمك.
                </li>
                <li>
                  <strong className="text-white">افتح محرِّر جوجل</strong>: اذهب لملف جوجل شيتس ◀ من الشريط العلوي اضغط <code>الإضافات (Extensions)</code> ◀ ثم <code>Apps Script</code>.
                </li>
                <li>
                  <strong className="text-white">لصق الكود</strong>: احذف أي أكواد تجريبية في محرر البرمجة وضَع الكود المنسوخ بدلاً منها.
                </li>
                <li>
                  <strong className="text-white">الحفظ والتشغيل</strong>: احفظ التغييرات، ثم اعد تحميل صفحة جوجل شيتس لتجد قائمة <code>ConvoBest WhatsApp</code> ظهرت بجوار قائمة الإضافات!
                </li>
                <li>
                  <strong className="text-white">الإرسال الفوري</strong>: حدد أسماء الأعمدة في ملف الشيت واكتب القالب واضغط إرسال من داخل جدول البيانات مباشرة!
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
