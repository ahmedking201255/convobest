'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Inbox, 
  Search, 
  Send, 
  SendHorizontal,
  Activity, 
  User, 
  Users,
  AlertTriangle, 
  Check, 
  CheckCheck,
  ChevronLeft,
  X,
  RefreshCw,
  Reply,
  Mic,
  Smile,
  Clock,
  Trash2,
  Paperclip
} from 'lucide-react';
import Link from 'next/link';

const CHAT_PAGE_SIZE = 40;
const MESSAGE_PAGE_SIZE = 50;
const DELETE_FOR_EVERYONE_LIMIT_MS = 60 * 60 * 60 * 1000;
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function InboxPage() {
  const [instances, setInstances] = useState<any[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [loadingInstances, setLoadingInstances] = useState(true);

  // User session
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Chats list state
  const [chats, setChats] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMoreChats, setLoadingMoreChats] = useState(false);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [chatOffset, setChatOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'customers' | 'groups'>('customers');
  const [avatarCache, setAvatarCache] = useState<Record<string, string>>({});
  const avatarCacheRef = useRef<Record<string, string>>({});
  const chatOffsetRef = useRef(0);
  const hasMoreChatsRef = useRef(true);
  const loadingChatsRef = useRef(false);
  const loadingMoreChatsRef = useRef(false);

  // Keep avatarCacheRef up to date with avatarCache state
  useEffect(() => {
    avatarCacheRef.current = avatarCache;
  }, [avatarCache]);

  useEffect(() => {
    chatOffsetRef.current = chatOffset;
  }, [chatOffset]);

  useEffect(() => {
    hasMoreChatsRef.current = hasMoreChats;
  }, [hasMoreChats]);

  useEffect(() => {
    loadingChatsRef.current = loadingChats;
  }, [loadingChats]);

  useEffect(() => {
    loadingMoreChatsRef.current = loadingMoreChats;
  }, [loadingMoreChats]);

  // Selected chat state
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const selectedNumberRef = useRef<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const messageOffsetRef = useRef(0);
  const hasMoreMessagesRef = useRef(true);
  const loadingMessagesRef = useRef(false);
  const loadingOlderMessagesRef = useRef(false);
  const isPrependingMessagesRef = useRef(false);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  // Keep selectedNumberRef in sync with selectedNumber state
  useEffect(() => {
    selectedNumberRef.current = selectedNumber;
  }, [selectedNumber]);

  useEffect(() => {
    if (!selectedNumber || typeof window === 'undefined') return;

    const isMobileInbox = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobileInbox) return;

    window.history.pushState(
      { ...(window.history.state || {}), inboxSelectedNumber: selectedNumber },
      '',
      window.location.href
    );

    const handleMobileBack = () => {
      if (selectedNumberRef.current) {
        setSelectedNumber(null);
      }
    };

    window.addEventListener('popstate', handleMobileBack);
    return () => window.removeEventListener('popstate', handleMobileBack);
  }, [selectedNumber]);

  useEffect(() => {
    hasMoreMessagesRef.current = hasMoreMessages;
  }, [hasMoreMessages]);

  useEffect(() => {
    loadingMessagesRef.current = loadingMessages;
  }, [loadingMessages]);

  useEffect(() => {
    loadingOlderMessagesRef.current = loadingOlderMessages;
  }, [loadingOlderMessages]);

  // Input states
  const [replyText, setReplyText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    if (!sendError) return;
    const timer = setTimeout(() => setSendError(''), 10000);
    return () => clearTimeout(timer);
  }, [sendError]);

  // Sync contacts state
  const [syncingContacts, setSyncingContacts] = useState(false);

  // Manual contact creation state
  const [newContactName, setNewContactName] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  // Lightbox & Reply States
  const [activeLightboxImg, setActiveLightboxImg] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [deleteMenuMessageId, setDeleteMenuMessageId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  const [reactionMenuMessageId, setReactionMenuMessageId] = useState<string | null>(null);
  const [reactingMessageId, setReactingMessageId] = useState<string | null>(null);

  // Stories / Status States
  const [stories, setStories] = useState<any[]>([]);
  const [loadingStories, setLoadingStories] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number>(-1);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(-1);
  const [isStoryViewerOpen, setIsStoryViewerOpen] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyVideoDurationMs, setStoryVideoDurationMs] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const formatTime = useCallback((dateStr: string) => {
    if (!isMounted) return '';
    try {
      return new Date(dateStr).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [isMounted]);

  const formatDate = useCallback((dateStr: string) => {
    if (!isMounted) return '';
    try {
      return new Date(dateStr).toLocaleDateString('ar-EG', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }, [isMounted]);

  const formatDateTime = useCallback((dateStr: string) => {
    const date = formatDate(dateStr);
    const time = formatTime(dateStr);
    if (!date) return time;
    if (!time) return date;
    return `${date} ${time}`;
  }, [formatDate, formatTime]);

  const formatDayLabel = useCallback((dateStr: string) => {
    if (!isMounted) return '';
    try {
      const value = new Date(dateStr);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (dayKey(value) === dayKey(today)) return 'اليوم';
      if (dayKey(value) === dayKey(yesterday)) return 'أمس';

      return value.toLocaleDateString('ar-EG', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }, [isMounted]);

  const isSameMessageDay = useCallback((a?: string, b?: string) => {
    if (!a || !b) return false;
    try {
      const first = new Date(a);
      const second = new Date(b);
      return first.getFullYear() === second.getFullYear()
        && first.getMonth() === second.getMonth()
        && first.getDate() === second.getDate();
    } catch {
      return false;
    }
  }, []);

  const isDeletedMessageText = useCallback((text: string | null | undefined) => {
    if (!text?.startsWith('{"_isDeleted":')) return false;
    try {
      return Boolean(JSON.parse(text)._isDeleted);
    } catch {
      return false;
    }
  }, []);

  const parseMediaPayload = useCallback((value: string | null | undefined): any | null => {
    if (!value) return null;
    const text = value.trim();
    if (!text) return null;

    const readJsonStringField = (field: string) => {
      const match = text.match(new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)"`));
      if (!match) return '';
      try {
        return JSON.parse(`"${match[1]}"`);
      } catch {
        return match[1];
      }
    };

    try {
      const parsed = JSON.parse(text);
      if (parsed?._isMedia === true) return parsed;
      if ((parsed?._isReply === true || parsed?._isGroupMessage === true) && typeof parsed.text === 'string') {
        return parseMediaPayload(parsed.text);
      }
    } catch {
      if (!text.includes('"_isMedia"')) return null;
      return {
        _isMedia: true,
        mediaType: readJsonStringField('mediaType') || 'document',
        mimetype: readJsonStringField('mimetype'),
        caption: readJsonStringField('caption'),
        fileName: readJsonStringField('fileName'),
        base64: readJsonStringField('base64'),
        mediaUrl: readJsonStringField('mediaUrl')
      };
    }

    return null;
  }, []);

  const readJsonStringField = useCallback((value: string, field: string) => {
    const match = value.match(new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)(?:"\\s*(?:,|})|$)`));
    if (!match) return '';
    try {
      return JSON.parse(`"${match[1].replace(/\\?$/, '')}"`);
    } catch {
      return match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
  }, []);

  const getMediaLabel = useCallback((media: any) => {
    const mediaType = String(media?.mediaType || '').toLowerCase();
    const mimetype = String(media?.mimetype || '').toLowerCase();
    if (mediaType === 'image' || mimetype.startsWith('image/')) return 'صورة';
    if (mediaType === 'audio' || mediaType === 'ptt' || mimetype.startsWith('audio/')) return 'رسالة صوتية';
    if (mediaType === 'video' || mimetype.startsWith('video/')) return 'فيديو';
    if (mediaType === 'sticker' || mimetype.includes('webp')) return 'ملصق';
    return 'مستند';
  }, []);

  const getMessagePreviewText = useCallback((value: string | null | undefined): string => {
    if (!value) return '';
    const media = parseMediaPayload(value);
    if (media) return getMediaLabel(media);

    let text = value.trim();
    for (let depth = 0; depth < 5; depth++) {
      if (!text.startsWith('{')) break;
      try {
        const parsed = JSON.parse(text);
        if ((parsed?._isReply === true || parsed?._isGroupMessage === true) && typeof parsed.text === 'string') {
          text = parsed.text.trim();
          const nestedMedia = parseMediaPayload(text);
          if (nestedMedia) return getMediaLabel(nestedMedia);
          continue;
        }
      } catch {
        if (text.includes('"_isGroupMessage"')) {
          const extractedText = readJsonStringField(text, 'text');
          if (extractedText) {
            text = extractedText.trim();
            const nestedMedia = parseMediaPayload(text);
            return nestedMedia ? getMediaLabel(nestedMedia) : text;
          }
        }
        break;
      }
      break;
    }

    return text;
  }, [getMediaLabel, parseMediaPayload, readJsonStringField]);

  const unwrapMessagePayload = useCallback((value: string | null | undefined) => {
    let text = String(value || '');
    let isGroupMsg = false;
    let groupSenderName = '';
    let replyInfo: any = null;

    for (let depth = 0; depth < 6; depth++) {
      const trimmed = text.trim();
      if (!trimmed.startsWith('{')) break;

      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?._isGroupMessage === true && typeof parsed.text === 'string') {
          isGroupMsg = true;
          groupSenderName = parsed.senderName || groupSenderName;
          text = parsed.text;
          continue;
        }
        if (parsed?._isReply === true && typeof parsed.text === 'string') {
          replyInfo = parsed;
          text = parsed.text;
          continue;
        }
      } catch {
        if (trimmed.includes('"_isGroupMessage"')) {
          isGroupMsg = true;
          groupSenderName = readJsonStringField(trimmed, 'senderName') || groupSenderName;
          const extractedText = readJsonStringField(trimmed, 'text');
          if (extractedText) {
            text = extractedText;
            continue;
          }
        }
        break;
      }

      break;
    }

    return {
      isGroupMsg,
      groupSenderName,
      isReply: Boolean(replyInfo),
      replyInfo,
      text
    };
  }, [readJsonStringField]);

  const getSendErrorMessage = useCallback((data: any, fallback: string) => {
    const main = data?.error || fallback;
    return data?.details ? `${main}: ${data.details}` : main;
  }, []);

  const canDeleteForEveryone = useCallback((message: any) => {
    if (!message || isDeletedMessageText(message.text)) return false;
    if (message.type !== 'SENT') return false;
    if (message.status === 'SENDING') return false;
    if (typeof message.id === 'string' && message.id.startsWith('temp-')) return false;

    const createdAt = new Date(message.createdAt).getTime();
    if (!Number.isFinite(createdAt)) return false;

    return Date.now() - createdAt <= DELETE_FOR_EVERYONE_LIMIT_MS;
  }, [isDeletedMessageText]);

  const getWhatsAppMessageId = useCallback((storedId: string) => {
    if (!storedId) return storedId;
    if (selectedInstanceId && storedId.startsWith(`${selectedInstanceId}:`)) {
      return storedId.slice(selectedInstanceId.length + 1);
    }

    const scopedIdMatch = storedId.match(/^[0-9a-fA-F-]{36}:(.+)$/);
    return scopedIdMatch ? scopedIdMatch[1] : storedId;
  }, [selectedInstanceId]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioLevelTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioSignalMaxRef = useRef(0);
  const audioSignalCheckedRef = useRef(false);

  const cleanupAudioRecording = () => {
    if (audioLevelTimerRef.current) {
      clearInterval(audioLevelTimerRef.current);
      audioLevelTimerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaRecorderRef.current?.stream) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerTab, setPickerTab] = useState<'emojis' | 'stickers'>('emojis');

  const EMOJIS = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
    '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗',
    '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯',
    '👍', '👎', '👌', '🤝', '👏', '🙌', '👐', '🤲', '🙏', '✍️',
    '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔'
  ];

  const STICKERS = [
    { id: 'hello', url: '/stickers/hello.png', label: '👋 أهلاً' },
    { id: 'love', url: '/stickers/love.png', label: '❤️ حب' },
    { id: 'haha', url: '/stickers/haha.png', label: '😂 ضحك' },
    { id: 'cool', url: '/stickers/cool.png', label: '😎 رائع' }
  ];

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
          channelCount: 1
        }
      });
      
      // Detect best supported audio format for MediaRecorder
      let mimeType = '';
      if (typeof MediaRecorder !== 'undefined') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        }
      }
      
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      audioSignalMaxRef.current = 0;
      audioSignalCheckedRef.current = false;

      try {
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextCtor();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        audioContextRef.current = audioContext;
        audioLevelTimerRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (let i = 0; i < samples.length; i++) {
            const centered = (samples[i] - 128) / 128;
            sum += centered * centered;
          }
          const rms = Math.sqrt(sum / samples.length);
          audioSignalMaxRef.current = Math.max(audioSignalMaxRef.current, rms);
          audioSignalCheckedRef.current = true;
        }, 120);
      } catch (levelErr) {
        console.warn('Audio level monitor unavailable:', levelErr);
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const actualMime = mediaRecorder.mimeType || mimeType;
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        const recordedMs = Date.now() - recordingStartTimeRef.current;
        const hasAudioSignal = !audioSignalCheckedRef.current || audioSignalMaxRef.current > 0.006;

        cleanupAudioRecording();

        if (recordedMs < 1000 || audioBlob.size < 1500 || !hasAudioSignal) {
          setSendError('لم يتم التقاط صوت من الميكروفون. تأكد أن الميكروفون غير مكتوم ثم جرّب مرة أخرى.');
          setIsRecording(false);
          setRecordingTime(0);
          return;
        }
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64DataUri = reader.result as string; // full data:audio/...;base64,XXXX
          const pureBase64 = base64DataUri.split(',')[1];
          
          if (selectedInstanceId && selectedNumber && pureBase64) {
            const tempId = `temp-${Date.now()}`;
            const tempMessage = {
              id: tempId,
              instanceId: selectedInstanceId,
              number: selectedNumber,
              text: JSON.stringify({
                _isMedia: true,
                mediaType: 'audio',
                mimetype: actualMime.split(';')[0], // e.g. 'audio/ogg' or 'audio/webm'
                base64: pureBase64,
                mediaUrl: ''
              }),
              type: 'SENT',
              status: 'SENDING',
              createdAt: new Date().toISOString()
            };
            setMessages(prev => [...prev, tempMessage]);
            setTimeout(() => scrollToBottom('smooth'), 50);

            setSendingMessage(true);
            try {
              const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  instanceId: selectedInstanceId,
                  number: selectedNumber,
                  mediaUrl: pureBase64,
                  mediaType: 'audio',
                  mimetype: actualMime,
                  fileName: actualMime.includes('webm') ? 'recording.webm' : 'recording.ogg'
                })
              });
              const data = await res.json();
              if (res.ok) {
                setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
                messageOffsetRef.current += 1;
                fetchChats(selectedInstanceId, true);
              } else {
                setMessages(prev => prev.filter(m => m.id !== tempId));
                setSendError(getSendErrorMessage(data, 'فشل إرسال التسجيل الصوتي'));
              }
            } catch (err: any) {
              setMessages(prev => prev.filter(m => m.id !== tempId));
              setSendError(err.message);
            } finally {
              setSendingMessage(false);
            }
          }
        };
      };

      mediaRecorder.start(250); // Collect data every 250ms for reliability
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('لم نتمكن من الوصول للميكروفون. يرجى التحقق من أذونات المتصفح.');
    }
  };

  const stopRecording = () => {
    if (Date.now() - recordingStartTimeRef.current < 900) {
      cancelRecording();
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.requestData();
      } catch {}
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanupAudioRecording();
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    mediaRecorderRef.current = null;
    setRecordingTime(0);
  };

  const addEmoji = (emoji: string) => {
    setReplyText(prev => prev + emoji);
  };

  const sendSticker = async (stickerUrl: string) => {
    setSendingMessage(true);
    setShowEmojiPicker(false);

    const portalUrl = window.location.origin;
    const absoluteStickerUrl = `${portalUrl}${stickerUrl}`;
    const tempId = `temp-${Date.now()}`;

    const tempMessage = {
      id: tempId,
      instanceId: selectedInstanceId,
      number: selectedNumber,
      text: JSON.stringify({
        _isMedia: true,
        mediaType: 'sticker',
        mimetype: 'image/webp',
        mediaUrl: absoluteStickerUrl
      }),
      type: 'SENT',
      status: 'SENDING',
      createdAt: new Date().toISOString()
    };

    // Optimistically append the sent sticker and scroll down immediately
    setMessages(prev => [...prev, tempMessage]);
    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          number: selectedNumber,
          mediaUrl: absoluteStickerUrl,
          mediaType: 'sticker',
          fileName: 'sticker.png'
        })
      });
      const data = await res.json();
      if (res.ok) {
        // Replace temp message with actual database message
        setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
        messageOffsetRef.current += 1;
        fetchChats(selectedInstanceId, true);
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setSendError(getSendErrorMessage(data, 'فشل إرسال الملصق'));
      }
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setSendError(err.message);
    } finally {
      setSendingMessage(false);
    }
  };

  const sendAttachmentFile = async (file: File) => {
    if (!selectedInstanceId || !selectedNumber) return;

    const mediaType = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : 'document';

    if (!['image', 'video'].includes(mediaType)) {
      setSendError('ÙŠÙ…ÙƒÙ† Ø¥Ø±ÙØ§Ù‚ ØµÙˆØ± Ø£Ùˆ ÙÙŠØ¯ÙŠÙˆ ÙÙ‚Ø· Ù…Ù† Ù‡Ø°Ø§ Ø§Ù„Ø²Ø±.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = String(reader.result || '');
      const pureBase64 = dataUrl.split(',')[1] || '';
      if (!pureBase64) {
        setSendError('ÙØ´Ù„ ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ù…Ù„Ù Ø§Ù„Ù…Ø±ÙÙ‚.');
        return;
      }

      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        id: tempId,
        instanceId: selectedInstanceId,
        number: selectedNumber,
        text: JSON.stringify({
          _isMedia: true,
          mediaType,
          mimetype: file.type,
          caption: replyText.trim(),
          fileName: file.name,
          base64: pureBase64,
          mediaUrl: ''
        }),
        type: 'SENT',
        status: 'SENDING',
        createdAt: new Date().toISOString()
      };

      setMessages(prev => [...prev, tempMessage]);
      setReplyText('');
      setSendingMessage(true);
      setTimeout(() => scrollToBottom('smooth'), 50);

      try {
        const res = await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instanceId: selectedInstanceId,
            number: selectedNumber,
            mediaUrl: pureBase64,
            mediaType,
            caption: replyText.trim(),
            mimetype: file.type,
            fileName: file.name
          })
        });
        const data = await res.json();
        if (res.ok) {
          setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
          messageOffsetRef.current += 1;
          fetchChats(selectedInstanceId, true);
        } else {
          setMessages(prev => prev.filter(m => m.id !== tempId));
          setSendError(getSendErrorMessage(data, 'ÙØ´Ù„ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„Ù…Ø±ÙÙ‚'));
        }
      } catch (err: any) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        setSendError(err.message);
      } finally {
        setSendingMessage(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) sendAttachmentFile(file);
  };

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      cleanupAudioRecording();
    };
  }, []);

  // Listen for Enter key globally to stop recording and send when recording
  useEffect(() => {
    if (!isRecording) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        stopRecording();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelRecording();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [isRecording]);

  const prevMessagesLengthRef = useRef(0);
  const prevLastMessageIdRef = useRef<string | null>(null);

  const fetchStories = useCallback(async (instanceId: string, silent = false) => {
    if (!silent) setLoadingStories(true);
    try {
      const res = await fetch(`/api/chat/statuses?instanceId=${instanceId}`);
      const data = await res.json();
      if (res.ok) {
        setStories(data.stories || []);
      }
    } catch (err) {
      console.error('Error fetching stories:', err);
    } finally {
      if (!silent) setLoadingStories(false);
    }
  }, []);

  const markStoryAsRead = async (number: string) => {
    if (!selectedInstanceId) return;
    try {
      await fetch('/api/chat/statuses/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          number: number
        })
      });
      // Update local state to show it is read
      setStories(prev => prev.map(story => {
        if (story.number === number) {
          return { ...story, hasUnread: false };
        }
        return story;
      }));
    } catch (err) {
      console.error('Failed to mark story as read:', err);
    }
  };

  const handleNextSlide = useCallback(() => {
    if (activeStoryIndex === -1) return;
    const activeStory = stories[activeStoryIndex];
    if (!activeStory) return;

    if (activeSlideIndex < activeStory.statuses.length - 1) {
      setActiveSlideIndex(prev => prev + 1);
    } else {
      // Go to next contact's story
      if (activeStoryIndex < stories.length - 1) {
        setActiveStoryIndex(prev => prev + 1);
        setActiveSlideIndex(0);
      } else {
        // No more stories, close viewer
        setIsStoryViewerOpen(false);
        setActiveStoryIndex(-1);
        setActiveSlideIndex(-1);
      }
    }
  }, [activeStoryIndex, activeSlideIndex, stories]);

  const handlePrevSlide = () => {
    if (activeStoryIndex === -1) return;
    
    if (activeSlideIndex > 0) {
      setActiveSlideIndex(prev => prev - 1);
    } else {
      // Go to previous contact's story (last slide of previous story)
      if (activeStoryIndex > 0) {
        const prevStory = stories[activeStoryIndex - 1];
        setActiveStoryIndex(prev => prev - 1);
        setActiveSlideIndex(prevStory.statuses.length - 1);
      } else {
        // At the very first slide, restart it
        setStoryProgress(0);
      }
    }
  };

  // Story autoplay effect
  useEffect(() => {
    setStoryVideoDurationMs(0);
  }, [activeStoryIndex, activeSlideIndex]);

  useEffect(() => {
    if (!isStoryViewerOpen || activeStoryIndex === -1 || activeSlideIndex === -1) {
      setStoryProgress(0);
      return;
    }

    const activeStory = stories[activeStoryIndex];
    if (!activeStory) return;

    const activeSlide = activeStory.statuses[activeSlideIndex];
    if (!activeSlide) return;

    // Mark the active status's story as read if not already read
    if (activeStory.hasUnread) {
      markStoryAsRead(activeStory.number);
    }

    setStoryProgress(0);

    const isVideoSlide = activeSlide.mediaType === 'video';
    const duration = isVideoSlide
      ? Math.min(Math.max(storyVideoDurationMs || 15000, 3000), 30000)
      : 5000;
    const intervalTime = 50;
    const steps = duration / intervalTime;
    let stepCount = 0;

    const interval = setInterval(() => {
      stepCount++;
      const prog = (stepCount / steps) * 100;
      setStoryProgress(Math.min(prog, 100));

      if (stepCount >= steps) {
        clearInterval(interval);
        // Advance slide
        handleNextSlide();
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isStoryViewerOpen, activeStoryIndex, activeSlideIndex, stories, handleNextSlide, storyVideoDurationMs]);

  const handleSyncContacts = async () => {
    if (!selectedInstanceId || syncingContacts) return;
    setSyncingContacts(true);
    try {
      const res = await fetch('/api/chat/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: selectedInstanceId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشلت المزامنة');
      
      // Refresh chats & stories list to load new synced contacts/statuses
      await fetchChats(selectedInstanceId);
      await fetchStories(selectedInstanceId);
      alert(data.message || 'تمت المزامنة بنجاح');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'حدث خطأ أثناء المزامنة');
    } finally {
      setSyncingContacts(false);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom helper
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: behavior
      });
    }
  };

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

  // Fetch paginated chats list. Searches and tab filters are handled server-side.
  const fetchChats = useCallback(async (instanceId: string, silent = false, append = false) => {
    if (append) {
      if (loadingChatsRef.current || loadingMoreChatsRef.current || !hasMoreChatsRef.current) return;
      loadingMoreChatsRef.current = true;
      setLoadingMoreChats(true);
    } else {
      if (!silent) {
        chatOffsetRef.current = 0;
        setChatOffset(0);
        hasMoreChatsRef.current = true;
        setHasMoreChats(true);
      }
      if (!silent) {
        loadingChatsRef.current = true;
        setLoadingChats(true);
      }
    }

    try {
      const offset = append ? chatOffsetRef.current : 0;
      const pageLimit = !append && silent
        ? Math.max(CHAT_PAGE_SIZE, chatOffsetRef.current || CHAT_PAGE_SIZE)
        : CHAT_PAGE_SIZE;
      const params = new URLSearchParams({
        instanceId,
        limit: String(pageLimit),
        offset: String(offset),
        search: searchQuery.trim(),
        tab: activeTab
      });
      const res = await fetch(`/api/chat?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        const incomingChats = data.chats || [];
        setChats(prev => {
          if (!append) return incomingChats;
          const seen = new Set(prev.map(chat => chat.number));
          return [...prev, ...incomingChats.filter((chat: any) => !seen.has(chat.number))];
        });

        const nextOffset = data.pagination?.nextOffset ?? offset + incomingChats.length;
        const hasMore = Boolean(data.pagination?.hasMore);
        chatOffsetRef.current = nextOffset;
        hasMoreChatsRef.current = hasMore;
        setChatOffset(nextOffset);
        setHasMoreChats(hasMore);
      }
    } catch (err) {
      console.error('Error fetching chats:', err);
    } finally {
      if (append) {
        loadingMoreChatsRef.current = false;
        setLoadingMoreChats(false);
      } else if (!silent) {
        loadingChatsRef.current = false;
        setLoadingChats(false);
      }
    }
  }, [activeTab, searchQuery]);

  const loadMoreChats = useCallback(() => {
    if (!selectedInstanceId || loadingChatsRef.current || loadingMoreChatsRef.current || !hasMoreChatsRef.current) return;
    fetchChats(selectedInstanceId, true, true);
  }, [fetchChats, selectedInstanceId]);

  const handleChatsScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceFromBottom < 160) {
      loadMoreChats();
    }
  }, [loadMoreChats]);

  // Mark chat as read in backend database and on WhatsApp
  const markChatAsRead = useCallback(async (instanceId: string, number: string) => {
    try {
      const res = await fetch('/api/chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId,
          number
        })
      });
      if (res.ok) {
        // Refresh chats list silently to update unread count badge
        fetchChats(instanceId, true);
      }
    } catch (err) {
      console.error('Failed to mark chat as read:', err);
    }
  }, [fetchChats]);

  // Fetch paginated messages for the selected contact number.
  const fetchMessages = useCallback(async (instanceId: string, number: string, silent = false, appendOlder = false) => {
    if (appendOlder) {
      if (loadingMessagesRef.current || loadingOlderMessagesRef.current || !hasMoreMessagesRef.current) return;
      loadingOlderMessagesRef.current = true;
      setLoadingOlderMessages(true);
    } else if (!silent) {
      loadingMessagesRef.current = true;
      setLoadingMessages(true);
    }

    const container = messagesContainerRef.current;
    const previousScrollHeight = appendOlder && container ? container.scrollHeight : 0;
    const previousScrollTop = appendOlder && container ? container.scrollTop : 0;
    if (appendOlder) {
      isPrependingMessagesRef.current = true;
    }

    try {
      const offset = appendOlder ? messageOffsetRef.current : 0;
      const pageLimit = !appendOlder && silent
        ? Math.max(MESSAGE_PAGE_SIZE, messageOffsetRef.current || MESSAGE_PAGE_SIZE)
        : MESSAGE_PAGE_SIZE;
      const params = new URLSearchParams({
        instanceId,
        number,
        limit: String(pageLimit),
        offset: String(offset)
      });
      const res = await fetch(`/api/chat/messages?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        // Guard: discard stale response if the user has switched to a different chat
        if (selectedNumberRef.current !== number) return;

        const serverMessages = data.messages || [];
        if (appendOlder) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const olderMessages = serverMessages.filter((m: any) => !existingIds.has(m.id));
            return [...olderMessages, ...prev];
          });

          requestAnimationFrame(() => {
            const currentContainer = messagesContainerRef.current;
            if (!currentContainer) return;
            const heightDelta = currentContainer.scrollHeight - previousScrollHeight;
            currentContainer.scrollTop = previousScrollTop + heightDelta;
          });
        } else if (silent) {
          // During polling: preserve any optimistic temp messages not yet confirmed
          setMessages(prev => {
            const tempMessages = prev.filter(m => typeof m.id === 'string' && m.id.startsWith('temp-'));
            const serverIds = new Set(serverMessages.map((m: any) => m.id));
            const olderLoadedMessages = prev.filter(m => !serverIds.has(m.id) && !(typeof m.id === 'string' && m.id.startsWith('temp-')));
            const survivingTemps = tempMessages.filter(m => !serverIds.has(m.id));
            const mergedMessages = [...olderLoadedMessages, ...serverMessages, ...survivingTemps];
            messageOffsetRef.current = mergedMessages.filter(m => !(typeof m.id === 'string' && m.id.startsWith('temp-'))).length;
            return mergedMessages;
          });
        } else {
          setMessages(serverMessages);
        }

        const nextOffset = silent && !appendOlder
          ? messageOffsetRef.current
          : data.pagination?.nextOffset ?? offset + serverMessages.length;
        const hasMore = Boolean(data.pagination?.hasMore);
        messageOffsetRef.current = nextOffset;
        hasMoreMessagesRef.current = hasMore;
        setHasMoreMessages(hasMore);
      }
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    } finally {
      if (appendOlder) {
        loadingOlderMessagesRef.current = false;
        setLoadingOlderMessages(false);
        setTimeout(() => {
          isPrependingMessagesRef.current = false;
        }, 0);
      } else if (!silent) {
        loadingMessagesRef.current = false;
        setLoadingMessages(false);
      }
    }
  }, []);

  const loadOlderMessages = useCallback(() => {
    if (!selectedInstanceId || !selectedNumber) return;
    if (loadingMessagesRef.current || loadingOlderMessagesRef.current || !hasMoreMessagesRef.current) return;
    fetchMessages(selectedInstanceId, selectedNumber, true, true);
  }, [fetchMessages, selectedInstanceId, selectedNumber]);

  const handleMessagesScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (event.currentTarget.scrollTop < 120) {
      loadOlderMessages();
    }
  }, [loadOlderMessages]);

  // Trigger stories and selected chat reset on instance change
  useEffect(() => {
    if (selectedInstanceId) {
      fetchStories(selectedInstanceId);
      setSelectedNumber(null);
      setMessages([]);
      messageOffsetRef.current = 0;
      hasMoreMessagesRef.current = true;
      setHasMoreMessages(true);
    }
  }, [selectedInstanceId, fetchStories]);

  // Reload the first chat page when instance, tab, or search changes.
  useEffect(() => {
    if (!selectedInstanceId) return;

    const timeout = setTimeout(() => {
      chatOffsetRef.current = 0;
      hasMoreChatsRef.current = true;
      setChatOffset(0);
      setHasMoreChats(true);
      setChats([]);
      fetchChats(selectedInstanceId);
    }, searchQuery.trim() ? 300 : 0);

    return () => clearTimeout(timeout);
  }, [selectedInstanceId, activeTab, searchQuery, fetchChats]);

  // Trigger messages load on contact selection
  useEffect(() => {
    if (selectedInstanceId && selectedNumber) {
      setMessages([]); // Clear previous messages list immediately to show a clean loading state
      messageOffsetRef.current = 0;
      hasMoreMessagesRef.current = true;
      setHasMoreMessages(true);
      setDeleteMenuMessageId(null);
      setReplyingToMessage(null);
      fetchMessages(selectedInstanceId, selectedNumber);
      markChatAsRead(selectedInstanceId, selectedNumber);
    }
  }, [selectedInstanceId, selectedNumber, fetchMessages, markChatAsRead]);

  // Automatically mark active chat as read when new unread messages arrive in the chats list
  useEffect(() => {
    if (selectedInstanceId && selectedNumber) {
      const activeChat = chats.find(c => c.number === selectedNumber);
      if (activeChat && activeChat.unreadCount > 0) {
        markChatAsRead(selectedInstanceId, selectedNumber);
      }
    }
  }, [chats, selectedInstanceId, selectedNumber, markChatAsRead]);

  // Scroll to bottom whenever messages list changes (smart scroll)
  useEffect(() => {
    if (isPrependingMessagesRef.current) {
      prevMessagesLengthRef.current = messages.length;
      prevLastMessageIdRef.current = messages[messages.length - 1]?.id || null;
      return;
    }

    if (messages.length === 0) {
      prevMessagesLengthRef.current = 0;
      prevLastMessageIdRef.current = null;
      return;
    }
    const container = messagesContainerRef.current;
    if (!container) return;

    const lastMessage = messages[messages.length - 1];
    const lastMessageId = lastMessage?.id || null;

    // Only scroll if a NEW message was actually added (count increased or ID changed)
    const isNewMessage = messages.length > prevMessagesLengthRef.current || lastMessageId !== prevLastMessageIdRef.current;

    if (isNewMessage) {
      const isInitialLoad = prevMessagesLengthRef.current === 0;
      
      // Check if user is scrolled near bottom (e.g. within 200px of bottom)
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;

      if (isInitialLoad) {
        setTimeout(() => {
          scrollToBottom('auto');
        }, 50);
      } else if (isNearBottom) {
        setTimeout(() => {
          scrollToBottom('smooth');
        }, 50);
      }
    }

    // Update refs for next render
    prevMessagesLengthRef.current = messages.length;
    prevLastMessageIdRef.current = lastMessageId;
  }, [messages]);

  // Lazy load and cache avatars
  useEffect(() => {
    if (!selectedInstanceId || chats.length === 0) return;

    let active = true;

    const fetchAvatars = async () => {
      for (const chat of chats) {
        if (!active) break;

        // Skip if already in local state cache (using the ref for fast checking)
        if (avatarCacheRef.current[chat.number] !== undefined) {
          continue;
        }

        const cacheKey = `avatar_cache_${selectedInstanceId}_${chat.number}`;
        const cached = localStorage.getItem(cacheKey);
        
        if (cached) {
          try {
            const { url, expiresAt } = JSON.parse(cached);
            if (expiresAt > Date.now()) {
              if (active) {
                setAvatarCache(prev => {
                  if (prev[chat.number] === url) return prev;
                  return { ...prev, [chat.number]: url };
                });
              }
              continue;
            }
          } catch (e) {
            localStorage.removeItem(cacheKey);
          }
        }

        // Fetch from API
        try {
          const res = await fetch(`/api/chat/avatar?instanceId=${selectedInstanceId}&number=${chat.number}`);
          if (!active) break;
          if (res.ok) {
            const data = await res.json();
            const url = data.url || '';
            const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours cache
            localStorage.setItem(cacheKey, JSON.stringify({ url, expiresAt }));
            setAvatarCache(prev => {
              if (prev[chat.number] === url) return prev;
              return { ...prev, [chat.number]: url };
            });
          } else {
            // Server error or timeout. Cache failure for 1 hour to prevent flooding
            const expiresAt = Date.now() + 1 * 60 * 60 * 1000; // 1 hour cache
            localStorage.setItem(cacheKey, JSON.stringify({ url: '', expiresAt }));
            setAvatarCache(prev => {
              if (prev[chat.number] === '') return prev;
              return { ...prev, [chat.number]: '' };
            });
          }
        } catch (err) {
          console.error(`Failed to fetch avatar for ${chat.number}:`, err);
          if (active) {
            // Network failure. Cache failure for 1 hour to prevent repeated attempts
            const expiresAt = Date.now() + 1 * 60 * 60 * 1000; // 1 hour cache
            localStorage.setItem(cacheKey, JSON.stringify({ url: '', expiresAt }));
            setAvatarCache(prev => {
              if (prev[chat.number] === '') return prev;
              return { ...prev, [chat.number]: '' };
            });
          }
        }
      }
    };

    fetchAvatars();
    return () => {
      active = false;
    };
  }, [chats, selectedInstanceId]);


  // Set up polling (every 5 seconds) for real-time synchronization
  useEffect(() => {
    if (!selectedInstanceId) return;

    const interval = setInterval(() => {
      fetchChats(selectedInstanceId, true);
      fetchStories(selectedInstanceId, true);
      if (selectedNumber) {
        fetchMessages(selectedInstanceId, selectedNumber, true);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedInstanceId, selectedNumber, fetchChats, fetchMessages, fetchStories]);

  // Handle sending a message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstanceId || !selectedNumber || !replyText.trim() || sendingMessage) return;

    setSendingMessage(true);
    setSendError('');

    const currentInstance = instances.find(inst => inst.id === selectedInstanceId);
    const myJid = currentInstance?.jid || '';

    // If we are replying to a message
    let quotedBody = undefined;
    if (replyingToMessage) {
      const participantJid = replyingToMessage.type === 'RECEIVED'
        ? `${selectedNumber}@s.whatsapp.net`
        : myJid;

      let plainText = replyingToMessage.text;
        plainText = getMessagePreviewText(plainText);

      quotedBody = {
        messageId: getWhatsAppMessageId(replyingToMessage.id),
        participant: participantJid,
        text: plainText
      };
    }

    const tempId = `temp-${Date.now()}`;
    const cleanReplyText = replyText.trim();
    let dbText = cleanReplyText;
    if (replyingToMessage && quotedBody) {
      dbText = JSON.stringify({
        _isReply: true,
        text: cleanReplyText,
        quotedId: replyingToMessage.id,
        quotedText: quotedBody.text,
        quotedParticipant: quotedBody.participant
      });
    }

    const tempMessage = {
      id: tempId,
      instanceId: selectedInstanceId,
      number: selectedNumber,
      text: dbText,
      type: 'SENT',
      status: 'SENDING',
      createdAt: new Date().toISOString()
    };

    // Optimistically append the sent message and clear inputs immediately!
    setMessages(prev => [...prev, tempMessage]);
    setReplyText('');
    setReplyingToMessage(null);
    setTimeout(() => scrollToBottom('smooth'), 50);

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          number: selectedNumber,
          text: cleanReplyText,
          quoted: quotedBody
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(getSendErrorMessage(data, 'حدث خطأ أثناء إرسال الرسالة'));

      // Replace the temp message with the actual message from database
      setMessages(prev => prev.map(m => m.id === tempId ? data.message : m));
      messageOffsetRef.current += 1;
      
      // Refresh chats list to update last message preview
      fetchChats(selectedInstanceId, true);
    } catch (err: any) {
      // Remove temp message and show error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setSendError(err.message);
      // Restore input text if send failed
      setReplyText(cleanReplyText);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleDeleteMessage = async (message: any, mode: 'me' | 'everyone') => {
    if (!selectedInstanceId || !message?.id || deletingMessageId) return;

    setDeletingMessageId(message.id);
    setDeleteMenuMessageId(null);
    setSendError('');

    try {
      const res = await fetch('/api/chat/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          messageId: message.id,
          mode
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'فشل حذف الرسالة');

      if (mode === 'me') {
        setMessages(prev => prev.filter(m => m.id !== message.id));
        if (replyingToMessage?.id === message.id) {
          setReplyingToMessage(null);
        }
      } else if (data.message) {
        setMessages(prev => prev.map(m => m.id === message.id ? data.message : m));
        if (replyingToMessage?.id === message.id) {
          setReplyingToMessage(null);
        }
      }

      fetchChats(selectedInstanceId, true);
    } catch (err: any) {
      setSendError(err.message || 'حدث خطأ أثناء حذف الرسالة');
    } finally {
      setDeletingMessageId(null);
    }
  };

  const handleReactMessage = async (message: any, reaction: string) => {
    if (!selectedInstanceId || !message?.id || reactingMessageId) return;

    const nextReaction = message.reactionFromMe === reaction ? '' : reaction;
    setReactingMessageId(message.id);
    setReactionMenuMessageId(null);
    setSendError('');

    setMessages(prev => prev.map(m => (
      m.id === message.id ? { ...m, reactionFromMe: nextReaction || null } : m
    )));

    try {
      const res = await fetch('/api/chat/react', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstanceId,
          messageId: message.id,
          reaction: nextReaction
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details || data.error || 'فشل إرسال الريأكشن');

      if (data.message) {
        setMessages(prev => prev.map(m => m.id === message.id ? data.message : m));
      }
    } catch (err: any) {
      setMessages(prev => prev.map(m => (
        m.id === message.id ? { ...m, reactionFromMe: message.reactionFromMe || null } : m
      )));
      setSendError(err.message || 'حدث خطأ أثناء إرسال الريأكشن');
    } finally {
      setReactingMessageId(null);
    }
  };

  // Helper to render message content (text or parsed media)
  const renderMessageContent = (text: string) => {
    if (isDeletedMessageText(text)) {
      return <span className="italic text-[#90a4ae]">تم حذف هذه الرسالة</span>;
    }

    const media = parseMediaPayload(text);
    if (media) {
      const mediaType = String(media.mediaType || '').toLowerCase();
      const mimetype = String(media.mimetype || (
        mediaType === 'audio' ? 'audio/ogg; codecs=opus' :
        mediaType === 'video' ? 'video/mp4' :
        mediaType === 'sticker' ? 'image/webp' :
        mediaType === 'image' ? 'image/jpeg' :
        'application/octet-stream'
      ));
      const base64 = typeof media.base64 === 'string' ? media.base64.replace(/\s/g, '') : '';
      const mediaUrl = typeof media.mediaUrl === 'string' ? media.mediaUrl : '';
      const src = mediaUrl || (base64 ? `data:${mimetype};base64,${base64}` : '');
        
      if (!src) {
        return <span className="text-[#90a4ae] italic">فشل تحميل الوسائط</span>;
      }

      if (mediaType === 'image' || mimetype.startsWith('image/') && !mimetype.includes('webp')) {
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
      if (mediaType === 'video' || mimetype.startsWith('video/')) {
        return (
          <div className="flex flex-col gap-2">
            <video src={src} controls className="rounded-xl max-w-full max-h-[260px]" />
            {media.caption && <p className="whitespace-pre-wrap leading-relaxed break-all mt-1">{media.caption}</p>}
          </div>
        );
      }
      if (mediaType === 'audio' || mediaType === 'ptt' || mimetype.startsWith('audio/')) {
        return (
          <div className="flex flex-col gap-1 py-1 min-w-[220px]">
            <audio src={src} controls preload="metadata" className="w-full h-9 accent-[#00ffa7]" />
          </div>
        );
      }
      if (mediaType === 'sticker' || mimetype.includes('webp')) {
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
    }
    
    // Normal text message
    return <p className="whitespace-pre-wrap leading-relaxed break-all sm:break-normal">{text}</p>;
  };

  // Filter chats by search query and whether they have real messages
  const filteredChats = chats.filter(chat => {
    // Filter by active tab (customers vs groups)
    const matchesTab = activeTab === 'groups' ? chat.isGroup : !chat.isGroup;
    if (!matchesTab) return false;

    const hasSavedName = typeof chat.contactName === 'string' && chat.contactName.trim().length > 0;
    const matchesSearch = 
      chat.number.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (chat.contactName && chat.contactName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (chat.lastMessage && chat.lastMessage.toLowerCase().includes(searchQuery.toLowerCase()));

    if (searchQuery.trim() === '') {
      // Default: hide unnamed placeholder-only rows, but keep synced contacts with names visible.
      return chat.hasRealMessages || hasSavedName || chat.isGroup;
    } else {
      // Search: show all matching contacts/chats
      return matchesSearch;
    }
  });

  if (loadingInstances || loadingSession) {
    return (
      <div className="h-full flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00ffa7] to-[#00b0ff] flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#060b11] animate-spin" />
          </div>
          <span className="text-xs text-[#90a4ae]">جاري تحميل صندوق الوارد...</span>
        </div>
      </div>
    );
  }

  const activeChat = chats.find(chat => chat.number === selectedNumber);

  return (
    <div className="flex flex-col gap-3 md:gap-4 h-[calc(100dvh-70px)] max-h-[calc(100dvh-70px)] overflow-hidden text-right animate-fade-in relative p-3 md:p-6 w-full">
      
      {/* Top Header Block */}
      <div className={`${selectedNumber ? 'hidden md:flex' : 'flex'} flex-col sm:flex-row items-start sm:items-center justify-between gap-3 md:gap-4 flex-shrink-0`} dir="rtl">
        <div className="hidden md:block text-right">
          <h1 className="text-xl md:text-2xl font-extrabold text-white flex items-center gap-2">
            <Inbox className="w-5 h-5 text-[#00ffa7]" />
            <span>الصندوق الوارد</span>
          </h1>
          <p className="text-[10px] text-[#90a4ae] mt-1">تواصل مباشرة مع عملائك بالرسائل النصية من داخل لوحة التحكم.</p>
        </div>

        {instances.length > 0 && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto w-full md:w-auto" style={{ direction: 'rtl' }}>
            <label className="hidden sm:inline text-[10px] font-bold text-[#90a4ae] whitespace-nowrap">الرقم المربوط النشط:</label>
            <select 
              value={selectedInstanceId}
              onChange={(e) => setSelectedInstanceId(e.target.value)}
              className="bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-white rounded-xl px-3 py-2 text-xs outline-none transition-all cursor-pointer w-full sm:w-auto"
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
        <div className="glass-card flex flex-col items-center justify-center text-center py-16 px-6 gap-6 flex-1">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="flex flex-col gap-1.5 max-w-md">
            <h3 className="text-lg font-bold text-white">لم تقم بربط أي رقم هاتف متصل حالياً</h3>
            <p className="text-xs text-[#90a4ae] leading-relaxed">
              لاستقبال وإرسال الرسائل الحية، يجب أولاً ربط رقم هاتف واتساب واحد على الأقل وتفعيل اتصاله بالمسح الضوئي للـ QR.
            </p>
          </div>
          <Link href="/dashboard/instances" className="btn-primary text-xs font-bold py-3 px-6">
            اذهب لربط رقم واتساب بالمسح الضوئي
          </Link>
        </div>
      ) : (
        /* Main Chat Split Layout */
        <div className="flex-1 bg-[#0e1622]/40 border border-[rgba(255,255,255,0.06)] rounded-2xl overflow-hidden flex flex-row relative min-h-0">
          
          {/* 1. Active Chat Panel (Middle Column - Flex 1) */}
          <div className={`${selectedNumber ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0 bg-[#070c14]/40 h-full relative z-10`}>
            {selectedNumber ? (
              <>
                {/* Active Chat Header */}
                <div className="h-16 border-b border-[rgba(255,255,255,0.05)] px-3 md:px-6 flex items-center justify-between bg-[#0e1622]/50 flex-shrink-0" style={{ direction: 'rtl' }}>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedNumber(null)}
                      className="md:hidden w-9 h-9 rounded-full bg-[#121e2a] border border-[rgba(255,255,255,0.06)] text-[#cfd8dc] flex items-center justify-center hover:bg-[#1c2d3f] active:scale-95 transition-all"
                      aria-label="العودة إلى قائمة المحادثات"
                    >
                      <ChevronLeft className="w-4 h-4 rotate-180" />
                    </button>
                    <div className="w-9 h-9 rounded-full bg-[#121e2a] flex items-center justify-center border border-[#00ffa7]/20 text-[#00ffa7] overflow-hidden">
                      {avatarCache[selectedNumber] ? (
                        <img src={avatarCache[selectedNumber]} alt={activeChat?.contactName || selectedNumber} className="w-full h-full object-cover" />
                      ) : activeChat?.isGroup ? (
                        <Users className="w-4.5 h-4.5 text-[#00ffa7]" />
                      ) : (
                        <User className="w-4.5 h-4.5" />
                      )}
                    </div>
                    <div className="text-right">
                      <h4 className={`text-xs font-extrabold text-white ${!activeChat?.contactName ? 'font-mono' : ''}`}>
                        {activeChat?.contactName || selectedNumber}
                      </h4>
                      {activeChat?.contactName && (
                        <div className="text-[9px] text-[#607d8b] font-mono block mt-0.5 leading-none">
                          {selectedNumber}
                        </div>
                      )}
                      <span className="text-[8px] text-[#90a4ae] flex items-center gap-1 mt-1">
                        <span className="w-1 h-1 rounded-full bg-[#607d8b]"></span>
                        محادثة نشطة
                      </span>
                    </div>
                  </div>

                  {/* Close button for smaller screens */}
                  <button 
                    onClick={() => setSelectedNumber(null)}
                    className="hidden md:flex p-1 text-[#607d8b] hover:text-white rounded-lg border border-[rgba(255,255,255,0.06)] hover:bg-[#121e2a]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Messages Stream */}
                <div 
                  ref={messagesContainerRef}
                  className="flex-1 overflow-y-auto p-3 md:p-6 flex flex-col gap-3 md:gap-4 min-h-0"
                  onScroll={handleMessagesScroll}
                >
                  {loadingMessages && messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <Activity className="w-5 h-5 text-[#00ffa7] animate-spin" />
                    </div>
                  ) : (
                    <>
                    {loadingOlderMessages && (
                      <div className="self-center px-3 py-1 rounded-full bg-[#121e2a] border border-white/5 text-[10px] font-bold text-[#90a4ae] flex items-center gap-2">
                        <Activity className="w-3 h-3 animate-spin text-[#00ffa7]" />
                        <span>جاري تحميل الرسائل الأقدم...</span>
                      </div>
                    )}
                    {!loadingOlderMessages && hasMoreMessages && messages.length > 0 && (
                      <button
                        type="button"
                        onClick={loadOlderMessages}
                        className="self-center px-3 py-1 rounded-full bg-[#121e2a] hover:bg-[#1c2d3f] border border-white/5 text-[10px] font-bold text-[#90a4ae] hover:text-white transition-all"
                      >
                        تحميل رسائل أقدم
                      </button>
                    )}
                    {messages
                      .filter((msg) => !String(msg.text || '').trim().startsWith('تم استيراد جهة الاتصال:'))
                      .map((msg, idx, visibleMessages) => {
                        const isMe = msg.type === 'SENT';
                        const showDateDivider = idx === 0 || !isSameMessageDay(visibleMessages[idx - 1]?.createdAt, msg.createdAt);

                      const {
                        isGroupMsg,
                        groupSenderName,
                        isReply,
                        replyInfo,
                        text: messageText
                      } = unwrapMessagePayload(msg.text);

                      const isDeleted = isDeletedMessageText(messageText);

                      return (
                        <React.Fragment key={msg.id}>
                          {showDateDivider && (
                            <div className="self-center my-2 px-3 py-1 rounded-full bg-[#121e2a] border border-white/5 text-[10px] font-bold text-[#90a4ae] shadow-sm">
                              {formatDayLabel(msg.createdAt)}
                            </div>
                          )}
                          <div 
                            className={`relative flex group ${isMe ? 'self-start justify-start' : 'self-end justify-end'}`}
                          >
                          {!isDeleted && (
                            <div className={`absolute top-1.5 z-30 ${(reactionMenuMessageId === msg.id || deleteMenuMessageId === msg.id) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'} flex items-center gap-1 transition-opacity ${isMe ? 'right-1.5' : 'left-1.5'}`}>
                              <button
                                onClick={() => setReplyingToMessage(msg)}
                                className="p-1.5 rounded-lg bg-[#121e2a] hover:bg-[#1c2d3f] text-[#607d8b] hover:text-[#00ffa7] border border-white/5 transition-all cursor-pointer shadow-md"
                                title="رد على هذه الرسالة"
                              >
                                <Reply className="w-3.5 h-3.5" />
                              </button>

                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReactionMenuMessageId(reactionMenuMessageId === msg.id ? null : msg.id);
                                    setDeleteMenuMessageId(null);
                                  }}
                                  disabled={reactingMessageId === msg.id}
                                  className="p-1.5 rounded-lg bg-[#121e2a] hover:bg-[#1c2d3f] text-[#607d8b] hover:text-[#00ffa7] border border-white/5 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="إضافة ريأكشن"
                                >
                                  <Smile className="w-3.5 h-3.5" />
                                </button>

                                {reactionMenuMessageId === msg.id && (
                                  <div
                                    className={`absolute bottom-full mb-0 rounded-full bg-[#0e1622] border border-white/10 shadow-2xl z-40 px-2 py-1.5 flex items-center gap-1 before:content-[''] before:absolute before:left-0 before:right-0 before:top-full before:h-3 ${isMe ? 'right-0' : 'left-0'}`}
                                    dir="ltr"
                                  >
                                    {QUICK_REACTIONS.map((reaction) => (
                                      <button
                                        key={reaction}
                                        type="button"
                                        onClick={() => handleReactMessage(msg, reaction)}
                                        className={`w-7 h-7 rounded-full text-base flex items-center justify-center transition-all hover:bg-white/10 hover:scale-110 ${
                                          msg.reactionFromMe === reaction ? 'bg-[#00ffa7]/20 ring-1 ring-[#00ffa7]/40' : ''
                                        }`}
                                        title={msg.reactionFromMe === reaction ? 'إزالة الريأكشن' : `ريأكشن ${reaction}`}
                                      >
                                        {reaction}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteMenuMessageId(deleteMenuMessageId === msg.id ? null : msg.id);
                                    setReactionMenuMessageId(null);
                                  }}
                                  disabled={deletingMessageId === msg.id}
                                  className="p-1.5 rounded-lg bg-[#121e2a] hover:bg-[#1c2d3f] text-[#607d8b] hover:text-red-400 border border-white/5 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="حذف الرسالة"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>

                                {deleteMenuMessageId === msg.id && (
                                  <div
                                    className={`absolute bottom-full mb-2 w-40 overflow-hidden rounded-xl bg-[#0e1622] border border-white/10 shadow-2xl z-40 text-right ${isMe ? 'right-0' : 'left-0'}`}
                                    dir="rtl"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMessage(msg, 'me')}
                                      className="w-full px-3 py-2 text-[10px] text-[#cfd8dc] hover:bg-white/[0.06] transition-all text-right"
                                    >
                                      حذف لدي فقط
                                    </button>
                                    {canDeleteForEveryone(msg) && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMessage(msg, 'everyone')}
                                        className="w-full px-3 py-2 text-[10px] text-red-300 hover:bg-red-500/10 transition-all text-right border-t border-white/5"
                                      >
                                        حذف لدى الجميع
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Message Bubble */}
                          <div 
                            className={`max-w-[min(82vw,320px)] sm:max-w-[450px] p-3.5 rounded-2xl text-xs flex flex-col gap-1 shadow-md border transition-all ${
                              msg.status === 'SENDING' ? 'opacity-70' : ''
                            } ${
                              isMe 
                                ? 'bg-[#00ffa7]/10 border-[#00ffa7]/15 text-white rounded-br-none text-right' 
                                : 'bg-[#121e2a] border-[rgba(255,255,255,0.03)] text-[#90a4ae] rounded-bl-none text-right'
                            }`}
                          >
                             {isGroupMsg && !isMe && (
                               <span className="text-[10px] font-extrabold text-[#00ffa7] mb-1 block">
                                 {groupSenderName}
                               </span>
                             )}
                             {/* Quoted Message display within bubble */}
                             {!isDeleted && isReply && replyInfo && (() => {
                               const cleanQuotedPart = replyInfo.quotedParticipant ? replyInfo.quotedParticipant.split('@')[0] : '';
                               const cleanSelectedNum = selectedNumber ? selectedNumber.split('@')[0] : '';
                               const isQuotedFromClient = cleanQuotedPart === cleanSelectedNum;
                               
                               return (
                                 <div className="mb-2 p-2 rounded bg-black/20 border-r-2 border-[#00ffa7] text-right text-[10px] text-gray-400">
                                   <div className="font-bold text-[#00ffa7] mb-0.5">
                                     {isQuotedFromClient ? (activeChat?.contactName || selectedNumber) : 'أنت'}
                                   </div>
                                   <div className="truncate max-w-[250px] italic">
                                     {replyInfo.quotedText}
                                   </div>
                                 </div>
                               );
                             })()}

                            {renderMessageContent(messageText)}

                            <div className="flex items-center gap-1 justify-end mt-1 text-[8px] text-[#607d8b]">
                              <span>{formatDateTime(msg.createdAt)}</span>
                              {isMe && (
                                <span className="mr-0.5">
                                  {msg.status === 'SENDING' ? (
                                    <Clock className="w-3 h-3 text-white/40 animate-pulse" />
                                  ) : msg.status === 'READ' ? (
                                    <CheckCheck className="w-3 h-3 text-[#00ffa7]" />
                                  ) : msg.status === 'DELIVERED' ? (
                                    <CheckCheck className="w-3 h-3 text-white/40" />
                                  ) : (
                                    <Check className="w-3 h-3 text-white/40" />
                                  )}
                                </span>
                              )}
                            </div>
                            {(msg.reactionFromMe || msg.reactionFromClient) && (
                              <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-start' : 'justify-end'}`}>
                                {msg.reactionFromClient && (
                                  <span
                                    className="inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded-full bg-[#0c121c] border border-white/10 text-sm shadow-sm"
                                    title="ريأكشن العميل"
                                  >
                                    {msg.reactionFromClient}
                                  </span>
                                )}
                                {msg.reactionFromMe && (
                                  <span
                                    className="inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded-full bg-[#00ffa7]/15 border border-[#00ffa7]/25 text-sm shadow-sm"
                                    title="ريأكشن منك"
                                  >
                                    {msg.reactionFromMe}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          </div>
                        </React.Fragment>
                      );
                    })}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send Input Footer */}
                <div className="border-t border-[rgba(255,255,255,0.05)] p-3 md:p-4 bg-[#0c121c]/70 flex-shrink-0">
                  {sendError && (
                    <div className="mb-2 text-[10px] text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg text-right">
                      {sendError}
                    </div>
                  )}

                  {/* Quoting Preview Card */}
                  {replyingToMessage && (
                    <div className="mb-3 p-3 rounded-xl bg-[#121e2a] border-r-4 border-[#00ffa7] flex items-center justify-between gap-4 animate-slide-up text-right" dir="rtl">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-bold text-[#00ffa7] mb-0.5">
                          الرد على: {replyingToMessage.type === 'RECEIVED' ? (activeChat?.contactName || selectedNumber) : 'أنت'}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate max-w-[500px]">
                          {(() => {
                            const text = replyingToMessage.text;
                            if (text.startsWith('{"_isMedia":')) {
                              try {
                                const parsed = JSON.parse(text);
                                if (parsed.mediaType === 'image') return '📷 صورة';
                                if (parsed.mediaType === 'audio') return '🎙️ رسالة صوتية';
                                if (parsed.mediaType === 'video') return '🎥 فيديو';
                                if (parsed.mediaType === 'sticker') return '✨ ملصق';
                                return '📄 مستند';
                              } catch {
                                return 'رسالة وسائط';
                              }
                            } else if (text.startsWith('{"_isReply":')) {
                              try {
                                return JSON.parse(text).text;
                              } catch {
                                return text;
                              }
                            }
                            return text;
                          })()}
                        </div>
                      </div>
                      <button 
                        onClick={() => setReplyingToMessage(null)}
                        className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Emoji and Sticker Picker Panel */}
                  {showEmojiPicker && (
                    <div 
                      className="absolute bottom-20 right-4 w-72 bg-[#0e1622] border border-[rgba(255,255,255,0.08)] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-slide-up text-right"
                      style={{ direction: 'rtl' }}
                    >
                      {/* Popover Header */}
                      <div className="grid grid-cols-2 p-1.5 bg-black/20 border-b border-[rgba(255,255,255,0.05)] gap-1">
                        <button 
                          type="button"
                          onClick={() => setPickerTab('emojis')}
                          className={`py-1.5 text-center rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            pickerTab === 'emojis' 
                              ? 'bg-[#00ffa7]/15 text-[#00ffa7] border border-[#00ffa7]/20 shadow-sm' 
                              : 'text-[#90a4ae] hover:text-white'
                          }`}
                        >
                          Emojis
                        </button>
                        <button 
                          type="button"
                          onClick={() => setPickerTab('stickers')}
                          className={`py-1.5 text-center rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            pickerTab === 'stickers' 
                              ? 'bg-[#00ffa7]/15 text-[#00ffa7] border border-[#00ffa7]/20 shadow-sm' 
                              : 'text-[#90a4ae] hover:text-white'
                          }`}
                        >
                          Stickers
                        </button>
                      </div>

                      {/* Popover Content */}
                      <div className="p-3 max-h-56 overflow-y-auto">
                        {pickerTab === 'emojis' ? (
                          <div className="grid grid-cols-8 gap-2 text-center text-lg select-none">
                            {EMOJIS.map(emoji => (
                              <button 
                                key={emoji}
                                type="button"
                                onClick={() => addEmoji(emoji)}
                                className="hover:scale-125 transition-transform cursor-pointer p-0.5"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 text-center">
                            {STICKERS.map(sticker => (
                              <button 
                                key={sticker.id}
                                type="button"
                                onClick={() => sendSticker(sticker.url)}
                                className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 transition-all cursor-pointer group"
                              >
                                <img 
                                  src={sticker.url} 
                                  alt={sticker.label} 
                                  className="w-12 h-12 object-contain group-hover:scale-110 transition-transform" 
                                />
                                <span className="text-[9px] text-[#90a4ae]">{sticker.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isRecording ? (
                    <div className="flex gap-2 items-center bg-[#060b11] border border-red-500/20 rounded-xl p-3 justify-between text-right animate-pulse" style={{ direction: 'rtl' }}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                        <span className="text-xs text-red-500 font-bold">جاري تسجيل الصوت...</span>
                        <span className="text-xs text-[#90a4ae] font-mono">
                          {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          type="button" 
                          onClick={cancelRecording}
                          className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[10px] font-bold transition-all cursor-pointer"
                        >
                          إلغاء
                        </button>
                        <button 
                          type="button" 
                          onClick={stopRecording}
                          className="px-3 py-1.5 rounded-lg bg-[#00ffa7] text-[#060b11] text-[10px] font-bold transition-all cursor-pointer"
                        >
                          إرسال
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSendMessage} className="flex gap-2 items-center relative" style={{ direction: 'rtl' }}>
                      <input
                        ref={attachmentInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={handleAttachmentChange}
                      />
                      {/* Emoji Trigger */}
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex-shrink-0 ${
                          showEmojiPicker 
                            ? 'bg-[#00ffa7]/15 text-[#00ffa7] border-[#00ffa7]/20' 
                            : 'bg-[#060b11] text-[#90a4ae] border-[rgba(255,255,255,0.06)] hover:text-white'
                        }`}
                        title="إيموجي وملصقات"
                      >
                        <Smile className="w-4.5 h-4.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => attachmentInputRef.current?.click()}
                        disabled={sendingMessage}
                        className="p-2 rounded-xl border transition-all cursor-pointer flex-shrink-0 bg-[#060b11] text-[#90a4ae] border-[rgba(255,255,255,0.06)] hover:text-white hover:border-[#00b0ff]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Ø¥Ø±ÙØ§Ù‚ ØµÙˆØ±Ø© Ø£Ùˆ ÙÙŠØ¯ÙŠÙˆ"
                      >
                        <Paperclip className="w-4.5 h-4.5" />
                      </button>

                      {/* Text Input */}
                      <textarea 
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="اكتب رسالة للرد على العميل..."
                        className="flex-1 bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] rounded-xl px-4 py-3 text-xs text-white outline-none resize-none min-h-[46px] max-h-[80px] transition-all"
                        disabled={sendingMessage}
                        rows={1}
                      />

                      {/* Send or Record Mic */}
                      {replyText.trim() === '' ? (
                        <button 
                          type="button" 
                          onClick={startRecording}
                          className="w-12 h-11 rounded-xl bg-white/5 hover:bg-white/10 text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all flex-shrink-0 cursor-pointer"
                          title="تسجيل رسالة صوتية"
                        >
                          <Mic className="w-4.5 h-4.5" />
                        </button>
                      ) : (
                        <button 
                          type="submit"
                          disabled={sendingMessage}
                          className="w-12 h-11 rounded-xl bg-[#00ffa7] text-[#060b11] flex items-center justify-center hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0 cursor-pointer"
                        >
                          <SendHorizontal className="w-4.5 h-4.5 transform rotate-180" />
                        </button>
                      )}
                    </form>
                  )}
                </div>
              </>
            ) : (
              /* No chat selected placeholder */
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4">
                <div className="w-14 h-14 rounded-full bg-[#0e1622] flex items-center justify-center border border-[rgba(255,255,255,0.04)] text-[#607d8b]">
                  <Inbox className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">صندوق المحادثات الواردة</h3>
                  <p className="text-[10px] text-[#607d8b] max-w-xs leading-relaxed">اختر إحدى المحادثات من القائمة الجانبية لعرض السجل بالكامل والرد على العميل مباشرة.</p>
                </div>
              </div>
            )}
          </div>

          {/* 2. Chats List Sidebar (Right Column - Width: 320px) */}
          <div className={`${selectedNumber ? 'hidden md:flex' : 'flex'} w-full md:w-[320px] border-r md:border-r-0 md:border-l border-[rgba(255,255,255,0.05)] bg-[#0c121c]/60 flex-col min-w-0 h-full flex-shrink-0 relative z-20`}>
            {/* Tab Selector: Customers & Groups */}
            <div className="grid grid-cols-2 p-1.5 border-b border-[rgba(255,255,255,0.05)] bg-black/15 gap-1.5 flex-shrink-0" dir="rtl">
              <button 
                onClick={() => setActiveTab('customers')}
                className={`py-1.5 text-center rounded-xl text-[10px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'customers' 
                    ? 'bg-[#00ffa7]/15 text-[#00ffa7] border border-[#00ffa7]/20 shadow-sm' 
                    : 'text-[#90a4ae] hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>العملاء</span>
              </button>
              <button 
                onClick={() => setActiveTab('groups')}
                className={`py-1.5 text-center rounded-xl text-[10px] font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'groups' 
                    ? 'bg-[#00ffa7]/15 text-[#00ffa7] border border-[#00ffa7]/20 shadow-sm' 
                    : 'text-[#90a4ae] hover:text-white hover:bg-white/[0.02] border border-transparent'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>المجموعات</span>
              </button>
            </div>

            {/* Search Box Header */}
            <div className="p-4 border-b border-[rgba(255,255,255,0.05)] flex flex-col gap-3 flex-shrink-0" style={{ direction: 'rtl' }}>
              <div className="relative">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث برقم الهاتف أو الرسالة..."
                  className="w-full bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-xs text-white rounded-xl pr-9 pl-3 py-2.5 outline-none transition-all"
                />
                <Search className="w-4 h-4 text-[#607d8b] absolute right-3 top-1/2 transform -translate-y-1/2" />
              </div>

              <button
                onClick={handleSyncContacts}
                disabled={syncingContacts}
                className="w-full py-2 px-3 rounded-xl bg-[#00ffa7]/10 hover:bg-[#00ffa7]/20 border border-[#00ffa7]/20 hover:border-[#00ffa7]/30 text-[10px] text-[#00ffa7] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${syncingContacts ? 'animate-spin' : ''}`} />
                <span>{syncingContacts ? 'جاري المزامنة...' : 'مزامنة جهات الاتصال والمحادثات'}</span>
              </button>
            </div>

            {/* WhatsApp Status Stories Strip */}
            {stories.length > 0 && (
              <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.03)] bg-black/10 flex flex-col gap-2 flex-shrink-0 text-right" dir="rtl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-[#90a4ae]">حالات الواتساب</span>
                  <span className="text-[8px] bg-[#00ffa7]/15 text-[#00ffa7] px-1.5 py-0.5 rounded-full font-bold font-mono">
                    {stories.filter(s => s.hasUnread).length} جديدة
                  </span>
                </div>
                <div className="flex flex-row overflow-x-auto gap-3 py-2 scrollbar-none min-h-[70px] max-w-full md:max-w-[288px]">
                  {stories.map((story, idx) => (
                    <button
                      key={`${story.number}-${idx}`}
                      onClick={() => {
                        setActiveStoryIndex(idx);
                        setActiveSlideIndex(0);
                        setIsStoryViewerOpen(true);
                      }}
                      className="flex flex-col items-center gap-1.5 flex-shrink-0 focus:outline-none group cursor-pointer"
                    >
                      {/* Avatar Circle with Ring */}
                      <div className={`w-11 h-11 rounded-full p-[2px] flex items-center justify-center transition-transform group-hover:scale-105 active:scale-95 ${
                        story.hasUnread 
                          ? 'bg-gradient-to-tr from-[#00ffa7] to-[#00b0ff]' 
                          : 'bg-white/10'
                      }`}>
                        <div className="w-full h-full rounded-full bg-[#0c121c] flex items-center justify-center text-white border border-[#0c121c]">
                          <span className="text-[10px] font-extrabold text-[#00ffa7]">
                            {story.contactName ? story.contactName.substring(0, 2).toUpperCase() : '?'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[9px] text-gray-300 truncate max-w-[55px] font-semibold">
                        {story.contactName}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chats list stream */}
            <div
              className="flex-1 overflow-y-auto divide-y divide-[rgba(255,255,255,0.02)] min-h-0"
              onScroll={handleChatsScroll}
            >
              
              {/* Show Add Contact Card if search query is a number and not in contacts */}
              {(() => {
                const searchCleanNumber = searchQuery.trim().replace(/\D/g, '');
                const isSearchQueryNumber = /^[0-9+\s]+$/.test(searchQuery.trim()) && searchCleanNumber.length >= 7;
                const hasExactContact = chats.some(chat => chat.number.replace(/\D/g, '') === searchCleanNumber);
                
                if (isSearchQueryNumber && !hasExactContact && !loadingChats) {
                  return (
                    <div className="p-4 m-3 rounded-xl bg-[#00ffa7]/5 border border-[#00ffa7]/15 flex flex-col gap-3 text-right" dir="rtl">
                      <h5 className="text-[11px] font-bold text-white">بدء محادثة مع رقم جديد:</h5>
                      <p className="text-[9px] text-[#90a4ae] leading-relaxed">الرقم ({searchQuery}) غير مسجل بجهات الاتصال. يمكنك إضافته والبدء في مراسلته فوراً.</p>
                      
                      <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-bold text-[#607d8b]">اسم العميل / جهة الاتصال:</label>
                        <input 
                          type="text" 
                          placeholder="مثال: أحمد علي" 
                          value={newContactName}
                          onChange={(e) => setNewContactName(e.target.value)}
                          className="bg-[#060b11] border border-[rgba(255,255,255,0.06)] focus:border-[#00ffa7] text-[10px] text-white rounded-lg px-2.5 py-1.5 outline-none transition-all"
                          disabled={addingContact}
                        />
                      </div>
                      
                      <button 
                        onClick={async () => {
                          const name = newContactName.trim() || 'عميل جديد';
                          const number = searchCleanNumber;
                          
                          setAddingContact(true);
                          try {
                            const res = await fetch('/api/chat/sync/create', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                instanceId: selectedInstanceId,
                                number: number,
                                contactName: name
                              })
                            });
                            
                            const data = await res.json();
                            if (res.ok) {
                              setNewContactName('');
                              setSearchQuery('');
                              await fetchChats(selectedInstanceId);
                              setSelectedNumber(number);
                            } else {
                              alert(data.error || 'فشلت إضافة جهة الاتصال');
                            }
                          } catch (err) {
                            console.error(err);
                            alert('حدث خطأ أثناء إضافة جهة الاتصال');
                          } finally {
                            setAddingContact(false);
                          }
                        }}
                        disabled={addingContact}
                        className="py-1.5 px-3 rounded-lg bg-[#00ffa7] text-[#060b11] text-[10px] font-bold hover:scale-105 active:scale-95 disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer text-center"
                      >
                        {addingContact ? 'جاري الإضافة...' : 'بدء المحادثة الآن'}
                      </button>
                    </div>
                  );
                }
                return null;
              })()}

              {loadingChats && chats.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-2">
                  <Activity className="w-5 h-5 text-[#00ffa7] animate-spin" />
                  <span className="text-[9px] text-[#607d8b]">جاري تحميل الدردشات...</span>
                </div>
              ) : filteredChats.length === 0 ? (
                // Only show empty state if we are not displaying the contact addition card
                !(/^[0-9+\s]+$/.test(searchQuery.trim()) && searchQuery.trim().replace(/\D/g, '').length >= 7 && !loadingChats && !hasMoreChats && !chats.some(chat => chat.number.replace(/\D/g, '') === searchQuery.trim().replace(/\D/g, ''))) && (
                  <div className="py-12 px-4 text-center flex flex-col gap-4 items-center">
                    <span className="text-[10px] text-[#607d8b] font-semibold">لا يوجد محادثات مطابقة.</span>
                  </div>
                )
              ) : (
                <>
                  {filteredChats.map((chat, idx) => {
                    const isActive = selectedNumber === chat.number;
                    return (
                      <button
                        key={`${chat.number}-${chat.lastMessageTime || idx}`}
                        onClick={() => setSelectedNumber(chat.number)}
                        className={`w-full p-4 flex items-start gap-3 text-right transition-all hover:bg-white/[0.01] border-r-2 ${
                          isActive 
                            ? 'bg-white/[0.02] border-r-[#00ffa7]' 
                            : 'border-r-transparent'
                        }`}
                        style={{ direction: 'rtl' }}
                      >
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-[#121e2a] border border-[rgba(255,255,255,0.04)] flex items-center justify-center text-[#607d8b] flex-shrink-0 mt-0.5 overflow-hidden">
                          {avatarCache[chat.number] ? (
                            <img src={avatarCache[chat.number]} alt={chat.contactName || chat.number} className="w-full h-full object-cover" />
                          ) : chat.isGroup ? (
                            <Users className="w-4.5 h-4.5 text-[#00ffa7]" />
                          ) : (
                            <User className="w-4.5 h-4.5" />
                          )}
                        </div>
  
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <h4 className={`text-xs font-bold text-white truncate ${!chat.contactName ? 'font-mono' : ''}`}>
                              {chat.contactName || chat.number}
                            </h4>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {chat.unreadCount > 0 && (
                                <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#00ffa7] text-[#060b11] text-[9px] font-black flex items-center justify-center animate-pulse">
                                  {chat.unreadCount}
                                </span>
                              )}
                              <span className="text-[7px] text-[#607d8b] font-mono whitespace-nowrap leading-none">
                                {formatDateTime(chat.lastMessageTime)}
                              </span>
                            </div>
                          </div>
                          {chat.contactName && (
                            <div className="text-[9px] text-[#607d8b] font-mono mb-1 leading-none">
                              {chat.number}
                            </div>
                          )}
                          <p className="text-[10px] text-[#90a4ae] truncate leading-normal flex items-center gap-1 justify-start">
                            {chat.lastMessageType === 'SENT' && (
                              <span className="text-[#607d8b] flex-shrink-0 ml-0.5">
                                {chat.lastMessageStatus === 'READ' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-[#00ffa7] inline-block align-middle" />
                                ) : chat.lastMessageStatus === 'DELIVERED' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-white/40 inline-block align-middle" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-white/40 inline-block align-middle" />
                                )}
                              </span>
                            )}
                            <span className="truncate">{chat.lastMessage}</span>
                          </p>
                        </div>
                      </button>
                    );
                  })}

                  {loadingMoreChats && (
                    <div className="py-4 flex items-center justify-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-[#00ffa7] animate-spin" />
                      <span className="text-[9px] text-[#607d8b]">Ø¬Ø§Ø±ÙŠ ØªØ­Ù…ÙŠÙ„ Ù…Ø­Ø§Ø¯Ø«Ø§Øª Ø£ÙƒØ«Ø±...</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightboxImg && (
        <div 
          className="fixed inset-0 bg-black/95 z-[9999] flex flex-col items-center justify-center p-4 cursor-zoom-out animate-fade-in"
          onClick={() => setActiveLightboxImg(null)}
        >
          {/* Zoom Close Header */}
          <div className="absolute top-4 right-4 left-4 flex justify-between items-center z-10" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setActiveLightboxImg(null)}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <a 
              href={activeLightboxImg} 
              download="whatsapp_image.jpg"
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2 bg-[#00ffa7] hover:scale-105 active:scale-95 text-[#060b11] rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              تحميل الصورة
            </a>
          </div>
          
          <img 
            src={activeLightboxImg} 
            alt="تكبير الصورة" 
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}

      {/* WhatsApp Stories Viewer Modal */}
      {isStoryViewerOpen && activeStoryIndex !== -1 && activeSlideIndex !== -1 && (() => {
        const activeStory = stories[activeStoryIndex];
        const activeSlide = activeStory?.statuses[activeSlideIndex];
        if (!activeStory || !activeSlide) return null;

        return (
          <div 
            className="fixed inset-0 bg-black/98 z-[99999] flex items-center justify-center p-4 select-none animate-fade-in"
            dir="rtl"
          >
            {/* Story Card Container */}
            <div className="relative w-full max-w-[420px] h-[90vh] max-h-[720px] bg-[#070c14] rounded-2xl border border-white/5 flex flex-col justify-between overflow-hidden shadow-2xl">
              
              {/* Top Control Header Overlay */}
              <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-20 flex flex-col gap-3">
                {/* Progress Indicators */}
                <div className="flex gap-1">
                  {activeStory.statuses.map((_: any, idx: number) => {
                    let widthPercent = 0;
                    if (idx < activeSlideIndex) widthPercent = 100;
                    else if (idx === activeSlideIndex) widthPercent = storyProgress;
                    
                    return (
                      <div key={idx} className="flex-1 h-[2px] bg-white/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#00ffa7] transition-all ease-linear"
                          style={{ 
                            width: `${widthPercent}%`,
                            transitionDuration: idx === activeSlideIndex ? '50ms' : '0ms' 
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Sender Info and Close */}
                <div className="flex items-center justify-between text-right">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#121e2a] border border-[#00ffa7]/20 flex items-center justify-center text-[#00ffa7] text-xs font-extrabold font-mono">
                      {activeStory.contactName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">{activeStory.contactName}</h4>
                      <span className="text-[8px] text-gray-400">
                        {formatTime(activeSlide.createdAt)}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={() => {
                      setIsStoryViewerOpen(false);
                      setActiveStoryIndex(-1);
                      setActiveSlideIndex(-1);
                    }}
                    className="p-1 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 w-full flex items-center justify-center bg-[#05080f] relative">
                {/* Left/Right Click Areas for Navigation */}
                <div className="absolute inset-y-0 right-0 w-1/3 z-10 cursor-pointer" onClick={handlePrevSlide} />
                <div className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer" onClick={handleNextSlide} />

                {/* Content Renderer */}
                {activeSlide.mediaType === 'image' && activeSlide.mediaUrl && (
                  <img 
                    src={activeSlide.mediaUrl} 
                    alt="حالة صورة" 
                    className="w-full h-full object-contain"
                  />
                )}

                {activeSlide.mediaType === 'video' && activeSlide.mediaUrl && (
                  <video 
                    src={activeSlide.mediaUrl} 
                    autoPlay 
                    playsInline 
                    controls
                    onLoadedMetadata={(event) => {
                      const duration = event.currentTarget.duration;
                      if (Number.isFinite(duration) && duration > 0) {
                        setStoryVideoDurationMs(duration * 1000);
                      }
                    }}
                    onEnded={handleNextSlide}
                    className="w-full h-full object-contain"
                  />
                )}

                {activeSlide.mediaUnavailable && (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-white bg-[#101720]">
                    <p className="text-sm font-extrabold leading-relaxed max-w-[300px]">
                      تعذر تحميل وسائط هذه الحالة
                    </p>
                    <p className="text-[10px] text-[#90a4ae] leading-relaxed max-w-[300px] mt-2">
                      الملف لم يصل محفوظًا مع الويبهوك. الحالات الجديدة ستظهر تلقائيًا بعد تفعيل حفظ ملفات الويبهوك.
                    </p>
                  </div>
                )}

                {activeSlide.mediaType === 'text' && (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-tr from-[#121a24] to-[#1a2d3c] text-center text-white">
                    <p className="text-base font-extrabold px-4 whitespace-pre-wrap leading-relaxed max-w-[320px] break-words">
                      {activeSlide.text}
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom Caption Overlay */}
              {(activeSlide.caption || (activeSlide.mediaType !== 'text' && activeSlide.text && !activeSlide.mediaUnavailable)) && (
                <div className="px-5 pb-5 pt-12 bg-gradient-to-t from-black/95 via-black/55 to-transparent absolute bottom-0 inset-x-0 z-20 text-center text-white pointer-events-none">
                  <p className="text-[12px] font-bold leading-relaxed max-w-[340px] mx-auto whitespace-pre-wrap break-words drop-shadow-lg">
                    {activeSlide.caption || activeSlide.text}
                  </p>
                </div>
              )}

            </div>
          </div>
        );
      })()}
 
    </div>
  );
}
