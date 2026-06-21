import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { extractDisplayText } from '@/lib/message-display';

export const dynamic = 'force-dynamic';

type StatusContent = {
  mediaUrl: string;
  mediaType: string;
  caption: string;
  text: string;
  mediaUnavailable?: boolean;
};

const MEDIA_KEYS = [
  { keys: ['imageMessage', 'ImageMessage'], mediaType: 'image' },
  { keys: ['videoMessage', 'VideoMessage'], mediaType: 'video' },
  { keys: ['audioMessage', 'AudioMessage'], mediaType: 'audio' },
  { keys: ['stickerMessage', 'StickerMessage'], mediaType: 'sticker' },
  { keys: ['documentMessage', 'DocumentMessage'], mediaType: 'document' },
];

const WRAPPER_KEYS = [
  'message',
  'Message',
  'ephemeralMessage',
  'EphemeralMessage',
  'viewOnceMessage',
  'ViewOnceMessage',
  'viewOnceMessageV2',
  'ViewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'ViewOnceMessageV2Extension',
  'documentWithCaptionMessage',
  'DocumentWithCaptionMessage',
  'associatedChildMessage',
  'AssociatedChildMessage',
];

function readString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function normalizeMediaType(type: string, mimetype = '') {
  const cleanType = type.toLowerCase();
  if (cleanType.includes('image')) return mimetype.toLowerCase().includes('webp') ? 'sticker' : 'image';
  if (cleanType.includes('video')) return 'video';
  if (cleanType.includes('audio') || cleanType === 'ptt') return 'audio';
  if (cleanType.includes('sticker')) return 'sticker';
  if (cleanType.includes('document')) return 'document';

  const cleanMime = mimetype.toLowerCase();
  if (cleanMime.startsWith('image/')) return cleanMime.includes('webp') ? 'sticker' : 'image';
  if (cleanMime.startsWith('video/')) return 'video';
  if (cleanMime.startsWith('audio/')) return 'audio';
  if (cleanMime) return 'document';

  return 'text';
}

function mimeForMediaType(mediaType: string, mimetype = '') {
  if (mimetype) return mimetype;
  if (mediaType === 'image') return 'image/jpeg';
  if (mediaType === 'video') return 'video/mp4';
  if (mediaType === 'audio') return 'audio/ogg';
  if (mediaType === 'sticker') return 'image/webp';
  return 'application/octet-stream';
}

function mediaSource(mediaUrl: string, base64: string, mimetype: string) {
  if (mediaUrl) return mediaUrl;
  if (!base64) return '';
  if (base64.startsWith('data:')) return base64;
  return `data:${mimetype};base64,${base64}`;
}

function parseJsonValue(value: string) {
  const text = value.trim();
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function getObject(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, any>;
}

function findMediaObject(value: unknown, depth = 0): StatusContent | null {
  if (depth > 8) return null;

  const parsed = typeof value === 'string' ? parseJsonValue(value) : value;
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const found = findMediaObject(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const object = getObject(parsed);
  if (!object) return null;

  if (object._isReply === true || object._isGroupMessage === true) {
    const nested = findMediaObject(object.text, depth + 1);
    if (nested) return nested;
  }

  const directMime = readString(object.mimetype, object.Mimetype, object.mimeType, object.MimeType);
  const directType = normalizeMediaType(readString(object.mediaType, object.MediaType, object.type, object.Type), directMime);
  const directBase64 = readString(object.base64, object.Base64);
  const directMediaUrl = readString(object.mediaUrl, object.MediaUrl, object.mediaURL, object.MediaURL, object.url, object.URL);

  if (object._isMedia === true || directBase64 || directMediaUrl || directType !== 'text') {
    const mimetype = mimeForMediaType(directType, directMime);
    const source = mediaSource(directMediaUrl, directBase64, mimetype);
    return {
      mediaUrl: source,
      mediaType: directType,
      caption: readString(object.caption, object.Caption),
      text: source ? '' : 'Media is unavailable because it was not stored with the webhook payload.',
      mediaUnavailable: !source,
    };
  }

  for (const descriptor of MEDIA_KEYS) {
    for (const key of descriptor.keys) {
      const media = getObject(object[key]);
      if (!media) continue;

      const mimetype = mimeForMediaType(
        descriptor.mediaType,
        readString(media.mimetype, media.Mimetype, object.mimetype, object.Mimetype)
      );
      const source = mediaSource(
        readString(object.mediaUrl, object.MediaUrl, object.mediaURL, object.MediaURL, media.mediaUrl, media.MediaUrl, media.url, media.URL),
        readString(object.base64, object.Base64, media.base64, media.Base64),
        mimetype
      );

      return {
        mediaUrl: source,
        mediaType: normalizeMediaType(descriptor.mediaType, mimetype),
        caption: readString(media.caption, media.Caption, object.caption, object.Caption),
        text: source ? '' : 'Media is unavailable because it was not stored with the webhook payload.',
        mediaUnavailable: !source,
      };
    }
  }

  for (const key of WRAPPER_KEYS) {
    const wrapper = object[key];
    if (!wrapper) continue;

    const wrapperObject = getObject(wrapper);
    const nestedValue = wrapperObject?.message || wrapperObject?.Message || wrapperObject || wrapper;
    const found = findMediaObject(nestedValue, depth + 1);
    if (found) return found;
  }

  return null;
}

function parseStatusContent(rawText: string): StatusContent {
  const media = findMediaObject(rawText);
  if (media) return media;

  return {
    mediaUrl: '',
    mediaType: 'text',
    caption: '',
    text: extractDisplayText(rawText),
  };
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');

    if (!instanceId) {
      return NextResponse.json({ error: 'معرف الحساب (instanceId) مطلوب' }, { status: 400 });
    }

    // Verify ownership of the instance
    const instance = await prisma.whatsAppInstance.findFirst({
      where: {
        id: instanceId,
        userId: user.userId
      }
    });

    if (!instance) {
      return NextResponse.json({ error: 'الحساب غير موجود أو لا تملكه' }, { status: 404 });
    }

    // Fetch all logs that belong to statuses (number is 'status' or starts with 'status:')
    // We only care about statuses from the last 24 hours (like WhatsApp stories)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const logs: any[] = await prisma.$queryRaw`
      SELECT
        \`id\`,
        \`instanceId\`,
        \`number\`,
        \`contactName\`,
        \`text\`,
        \`type\`,
        \`status\`,
        \`createdAt\`
      FROM \`MessageLog\`
      WHERE \`instanceId\` = ${instanceId}
        AND \`createdAt\` >= ${twentyFourHoursAgo}
        AND (
          \`number\` COLLATE utf8mb4_unicode_ci = CONVERT('status' USING utf8mb4) COLLATE utf8mb4_unicode_ci
          OR \`number\` COLLATE utf8mb4_unicode_ci LIKE CONVERT('status:%' USING utf8mb4) COLLATE utf8mb4_unicode_ci
        )
      ORDER BY \`createdAt\` ASC
    `;

    // Group logs by contact/sender number
    const storiesMap = new Map<string, any>();

    for (const log of logs) {
      let senderNumber = '';
      if (log.number.startsWith('status:')) {
        senderNumber = log.number.split(':')[1];
      } else {
        // Fallback for older statuses that were stored as 'status'
        senderNumber = log.contactName || 'unknown';
      }

      if (!senderNumber) continue;

      if (!storiesMap.has(senderNumber)) {
        storiesMap.set(senderNumber, {
          number: senderNumber,
          contactName: log.contactName || senderNumber,
          hasUnread: false,
          statuses: []
        });
      }

      const entry = storiesMap.get(senderNumber);

      const parsedContent = parseStatusContent(log.text);

      const isRead = log.status === 'READ';
      if (!isRead) {
        entry.hasUnread = true;
      }

      entry.statuses.push({
        id: log.id,
        mediaUrl: parsedContent.mediaUrl,
        mediaType: parsedContent.mediaType,
        caption: parsedContent.caption,
        text: parsedContent.text,
        mediaUnavailable: parsedContent.mediaUnavailable || false,
        createdAt: log.createdAt,
        status: log.status
      });
    }

    const stories = Array.from(storiesMap.values());

    const response = NextResponse.json({ stories });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return response;
  } catch (error: any) {
    console.error('Fetch statuses error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء تحميل الحالات', details: error.message },
      { status: 500 }
    );
  }
}
