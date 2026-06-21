import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { extractDisplayText } from '@/lib/message-display';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');
    const rawLimit = Number(searchParams.get('limit') || 40);
    const rawOffset = Number(searchParams.get('offset') || 0);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 40, 1), 100);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
    const take = limit + 1;
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const searchLike = `%${search}%`;
    const tab = searchParams.get('tab') === 'groups' ? 'groups' : 'customers';
    const isGroupsTab = tab === 'groups';

    if (!instanceId) {
      return NextResponse.json({ error: 'معرف الحساب (instanceId) مطلوب' }, { status: 400 });
    }

    const instance = await prisma.whatsAppInstance.findFirst({
      where: {
        id: instanceId,
        userId: user.userId
      }
    });

    if (!instance) {
      return NextResponse.json({ error: 'الحساب غير موجود أو لا تملكه' }, { status: 404 });
    }

    const chatRowsWithExtra: any[] = await prisma.$queryRaw`
      WITH ranked_messages AS (
        SELECT
          m.\`number\`,
          m.\`contactName\`,
          m.\`text\`,
          m.\`type\`,
          m.\`status\`,
          m.\`createdAt\`,
          TRUE AS \`hasMessage\`,
          (
            m.\`number\` LIKE '%-%'
            OR m.\`number\` REGEXP '^120363[0-9]{9,}$'
          ) AS \`isGroup\`,
          ROW_NUMBER() OVER (PARTITION BY m.\`number\` ORDER BY m.\`createdAt\` DESC, m.\`id\` DESC) AS rn
        FROM \`InboxMessage\` m
        WHERE m.\`instanceId\` = ${instanceId}
          AND m.\`number\` != 'status'
          AND m.\`number\` COLLATE utf8mb4_unicode_ci NOT LIKE CONVERT('status:%' USING utf8mb4) COLLATE utf8mb4_unicode_ci
          AND m.\`number\` != '0'
          AND (
            m.\`number\` LIKE '%-%'
            OR m.\`number\` REGEXP '^[0-9]{7,15}$'
            OR m.\`number\` REGEXP '^120363[0-9]{9,}$'
          )
      ),
      latest AS (
        SELECT
          \`number\`,
          \`contactName\`,
          \`text\`,
          \`type\`,
          \`status\`,
          \`createdAt\`,
          \`hasMessage\`,
          \`isGroup\`
        FROM ranked_messages
        WHERE rn = 1
      ),
      active AS (
        SELECT *
        FROM latest
        WHERE (
            CONVERT(${search} USING utf8mb4) COLLATE utf8mb4_unicode_ci = CONVERT('' USING utf8mb4) COLLATE utf8mb4_unicode_ci
            OR LOWER(latest.\`number\`) COLLATE utf8mb4_unicode_ci LIKE CONVERT(${searchLike} USING utf8mb4) COLLATE utf8mb4_unicode_ci
            OR LOWER(COALESCE(latest.\`contactName\`, '')) COLLATE utf8mb4_unicode_ci LIKE CONVERT(${searchLike} USING utf8mb4) COLLATE utf8mb4_unicode_ci
            OR LOWER(COALESCE(latest.\`text\`, '')) COLLATE utf8mb4_unicode_ci LIKE CONVERT(${searchLike} USING utf8mb4) COLLATE utf8mb4_unicode_ci
          )
          AND (
            (${isGroupsTab} AND latest.\`isGroup\`)
            OR (${!isGroupsTab} AND NOT latest.\`isGroup\`)
          )
      ),
      contact_matches AS (
        SELECT
          c.\`number\`,
          c.\`contactName\`,
          '' AS \`text\`,
          'CONTACT' AS \`type\`,
          'READ' AS \`status\`,
          c.\`updatedAt\` AS \`createdAt\`,
          FALSE AS \`hasMessage\`,
          c.\`isGroup\`
        FROM \`ChatContact\` c
        LEFT JOIN latest ON latest.\`number\` = c.\`number\`
        WHERE CONVERT(${search} USING utf8mb4) COLLATE utf8mb4_unicode_ci != CONVERT('' USING utf8mb4) COLLATE utf8mb4_unicode_ci
          AND latest.\`number\` IS NULL
          AND c.\`instanceId\` = ${instanceId}
          AND (
            (${isGroupsTab} AND c.\`isGroup\`)
            OR (${!isGroupsTab} AND NOT c.\`isGroup\`)
          )
          AND (
            LOWER(c.\`number\`) COLLATE utf8mb4_unicode_ci LIKE CONVERT(${searchLike} USING utf8mb4) COLLATE utf8mb4_unicode_ci
            OR LOWER(COALESCE(c.\`contactName\`, '')) COLLATE utf8mb4_unicode_ci LIKE CONVERT(${searchLike} USING utf8mb4) COLLATE utf8mb4_unicode_ci
          )
      )
      SELECT *
      FROM (
        SELECT * FROM active
        UNION ALL
        SELECT * FROM contact_matches
      ) combined_rows
      ORDER BY combined_rows.\`hasMessage\` DESC, combined_rows.\`createdAt\` DESC
      LIMIT ${take}
      OFFSET ${offset}
    `;

    const hasMore = chatRowsWithExtra.length > limit;
    const chatRows = chatRowsWithExtra.slice(0, limit);

    const unreadRows: any[] = await prisma.$queryRaw`
      SELECT \`number\`, COUNT(*) as \`unreadCount\`
      FROM \`InboxMessage\`
      WHERE \`instanceId\` = ${instanceId}
        AND \`type\` = 'RECEIVED'
        AND \`status\` != 'READ'
        AND \`number\` != 'status'
        AND \`number\` COLLATE utf8mb4_unicode_ci NOT LIKE CONVERT('status:%' USING utf8mb4) COLLATE utf8mb4_unicode_ci
      GROUP BY \`number\`
    `;

    const unreadMap = new Map<string, number>();
    for (const row of unreadRows) {
      unreadMap.set(row.number, Number(row.unreadCount || 0));
    }

    const getFriendlyPreview = (text: string): string => {
      if (!text) return '';

      if (text.startsWith('{"_isDeleted":')) {
        return 'تم حذف هذه الرسالة';
      }

      if (text.startsWith('{"_isGroupMessage":')) {
        try {
          const parsed = JSON.parse(text);
          const innerText = getFriendlyPreview(parsed.text);
          return `${parsed.senderName}: ${innerText}`;
        } catch {
          return text;
        }
      }

      if (text.startsWith('{"_isReply":')) {
        try {
          const parsed = JSON.parse(text);
          return getFriendlyPreview(parsed.text);
        } catch {
          return text;
        }
      }

      if (text.startsWith('{"_isMedia":')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.mediaType === 'image') return 'صورة';
          if (parsed.mediaType === 'audio') return 'رسالة صوتية';
          if (parsed.mediaType === 'video') return 'فيديو';
          if (parsed.mediaType === 'sticker') return 'ملصق';
          return 'مستند';
        } catch {
          return 'رسالة وسائط';
        }
      }
      return text;
    };

    const chats = chatRows.map(row => ({
      number: row.number,
      contactName: row.contactName || null,
      lastMessage: extractDisplayText(row.text || ''),
      lastMessageTime: row.createdAt,
      lastMessageType: row.type,
      lastMessageStatus: row.status || 'SENT',
      hasRealMessages: Boolean(row.hasMessage),
      unreadCount: unreadMap.get(row.number) || 0,
      isGroup: Boolean(row.isGroup)
    }));

    return NextResponse.json({
      chats,
      pagination: {
        limit,
        offset,
        nextOffset: offset + chats.length,
        hasMore
      }
    });
  } catch (error: any) {
    console.error('Fetch chats error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء تحميل المحادثات', details: error.message },
      { status: 500 }
    );
  }
}
