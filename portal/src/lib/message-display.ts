const MAX_DISPLAY_LENGTH = 2000;

const MEDIA_LABELS: Record<string, string> = {
  image: 'صورة',
  audio: 'رسالة صوتية',
  ptt: 'رسالة صوتية',
  video: 'فيديو',
  sticker: 'ملصق',
  document: 'مستند',
  contact: 'جهة اتصال',
  contacts: 'جهات اتصال',
  location: 'موقع',
};

const clampText = (value: string) => {
  const clean = value.trim();
  return clean.length > MAX_DISPLAY_LENGTH
    ? `${clean.slice(0, MAX_DISPLAY_LENGTH)}...`
    : clean;
};

const mediaLabel = (value: Record<string, unknown>) => {
  const explicitType = typeof value.mediaType === 'string' ? value.mediaType.toLowerCase() : '';
  if (MEDIA_LABELS[explicitType]) return MEDIA_LABELS[explicitType];

  const mime = typeof value.mimetype === 'string' ? value.mimetype.toLowerCase() : '';
  if (mime.startsWith('image/')) return mime.includes('webp') ? 'ملصق' : 'صورة';
  if (mime.startsWith('audio/')) return 'رسالة صوتية';
  if (mime.startsWith('video/')) return 'فيديو';
  if (mime) return 'مستند';
  return 'رسالة وسائط';
};

const readJsonStringField = (value: string, field: string) => {
  const match = value.match(new RegExp(`"${field}"\\s*:\\s*"([\\s\\S]*?)(?:"\\s*(?:,|})|$)`));
  if (!match) return '';
  try {
    return JSON.parse(`"${match[1].replace(/\\?$/, '')}"`);
  } catch {
    return match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
};

const extractFromObject = (value: Record<string, unknown>, depth: number): string => {
  if (depth > 6) return 'رسالة غير نصية';

  if (value._isGroupMessage === true || value._isReply === true) {
    return extractDisplayText(value.text, depth + 1);
  }

  if (value._isMedia === true || value.base64 || value.mediaUrl || value.mediaType || value.mimetype) {
    const label = mediaLabel(value);
    const caption = extractDisplayText(value.caption, depth + 1);
    return caption && caption !== 'رسالة غير نصية' ? `${label}: ${caption}` : label;
  }

  const directKeys = [
    'text',
    'body',
    'caption',
    'conversation',
    'contentText',
    'selectedDisplayText',
    'displayText',
    'title',
  ];

  for (const key of directKeys) {
    if (value[key] !== undefined && value[key] !== null) {
      const extracted = extractDisplayText(value[key], depth + 1);
      if (extracted && extracted !== 'رسالة غير نصية') return extracted;
    }
  }

  const nestedMessageKeys = [
    'message',
    'extendedTextMessage',
    'imageMessage',
    'audioMessage',
    'videoMessage',
    'stickerMessage',
    'documentMessage',
  ];

  for (const key of nestedMessageKeys) {
    if (value[key] && typeof value[key] === 'object') {
      const extracted = extractDisplayText(value[key], depth + 1);
      if (extracted && extracted !== 'رسالة غير نصية') return extracted;
    }
  }

  return 'رسالة غير نصية';
};

export function extractDisplayText(value: unknown, depth = 0): string {
  if (value === null || value === undefined) return '';

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractDisplayText(item, depth + 1);
      if (extracted && extracted !== 'رسالة غير نصية') return extracted;
    }
    return 'رسالة غير نصية';
  }

  if (typeof value === 'object') {
    return clampText(extractFromObject(value as Record<string, unknown>, depth));
  }

  if (typeof value !== 'string') return clampText(String(value));

  const text = value.trim();
  if (!text) return '';

  if ((text.startsWith('{') || text.startsWith('[')) && depth <= 6) {
    try {
      return extractDisplayText(JSON.parse(text), depth + 1);
    } catch {
      if (text.includes('"_isGroupMessage"')) {
        const groupText = readJsonStringField(text, 'text');
        if (groupText) return extractDisplayText(groupText, depth + 1);
      }

      if (text.includes('"_isMedia"')) {
        const mediaType = readJsonStringField(text, 'mediaType');
        const mimetype = readJsonStringField(text, 'mimetype');
        return mediaLabel({ mediaType, mimetype });
      }

      const captionMatch = text.match(/"caption"\s*:\s*"((?:\\.|[^"\\])*)"/);
      if (captionMatch) {
        try {
          const caption = JSON.parse(`"${captionMatch[1]}"`);
          return clampText(caption);
        } catch {
          return clampText(captionMatch[1]);
        }
      }
      return 'رسالة غير نصية';
    }
  }

  if (text.length > 500 && /^[A-Za-z0-9+/=\s]+$/.test(text)) {
    return 'رسالة وسائط';
  }

  return clampText(text);
}
