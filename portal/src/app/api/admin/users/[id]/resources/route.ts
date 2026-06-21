import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp';
import { extractDisplayText } from '@/lib/message-display';
import { deleteInstanceData } from '@/lib/instance-cleanup';

async function requireAdmin() {
  const adminUser = await getSessionUser();
  if (!adminUser || adminUser.role !== 'ADMIN') return null;
  return adminUser;
}

async function userExists(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true }
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin();
    if (!adminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const targetUser = await userExists(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'usage';
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 80), 1), 200);

    if (view === 'usage') {
      const [
        instances,
        inboxCount,
        contactCount,
        campaignCount,
        campaignRecipients,
        messageTypes
      ] = await Promise.all([
        prisma.whatsAppInstance.findMany({
          where: { userId: id },
          select: { id: true, name: true, status: true, createdAt: true }
        }),
        prisma.inboxMessage.count({ where: { instance: { userId: id } } }),
        prisma.chatContact.count({ where: { instance: { userId: id } } }),
        prisma.campaign.count({ where: { userId: id } }),
        prisma.campaignRecipient.groupBy({
          by: ['status'],
          where: { campaign: { userId: id } },
          _count: { _all: true }
        }),
        prisma.messageLog.groupBy({
          by: ['type'],
          where: { instance: { userId: id } },
          _count: { _all: true }
        })
      ]);

      const messageSummary = Object.fromEntries(
        messageTypes.map(row => [row.type, row._count._all])
      );
      const campaignSummary = Object.fromEntries(
        campaignRecipients.map(row => [row.status, row._count._all])
      );

      return NextResponse.json({
        user: targetUser,
        usage: {
          instancesTotal: instances.length,
          instancesConnected: instances.filter(inst => inst.status === 'CONNECTED').length,
          instancesDisconnected: instances.filter(inst => inst.status !== 'CONNECTED').length,
          inboxMessages: inboxCount,
          contacts: contactCount,
          campaigns: campaignCount,
          campaignRecipients: campaignSummary,
          messages: messageSummary
        },
        instances
      });
    }

    if (view === 'instances') {
      const instances = await prisma.whatsAppInstance.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          jid: true,
          status: true,
          createdAt: true,
          _count: {
            select: {
              logs: true,
              inboxMessages: true,
              chatContacts: true,
              campaigns: true
            }
          }
        }
      });

      return NextResponse.json({ user: targetUser, instances });
    }

    if (view === 'inbox') {
      const instanceId = searchParams.get('instanceId') || undefined;
      const number = searchParams.get('number') || undefined;
      const mode = searchParams.get('mode') || 'chats';

      if (mode === 'messages') {
        if (!instanceId || !number) {
          return NextResponse.json({ error: 'instanceId and number are required' }, { status: 400 });
        }

        const instance = await prisma.whatsAppInstance.findFirst({
          where: { id: instanceId, userId: id },
          select: { id: true }
        });

        if (!instance) {
          return NextResponse.json({ error: 'Instance not found for this user' }, { status: 404 });
        }

        const messages = await prisma.inboxMessage.findMany({
          where: { instanceId, number },
          orderBy: [
            { createdAt: 'desc' },
            { id: 'desc' }
          ],
          take: limit
        });

        return NextResponse.json({
          user: targetUser,
          messages: messages.reverse()
        });
      }

      const chatRows: any[] = await prisma.$queryRaw`
        WITH ranked_messages AS (
          SELECT
            m.\`instanceId\`,
            m.\`number\`,
            m.\`contactName\`,
            m.\`text\`,
            m.\`type\`,
            m.\`status\`,
            m.\`createdAt\`,
            i.\`name\` AS \`instanceName\`,
            ROW_NUMBER() OVER (PARTITION BY m.\`instanceId\`, m.\`number\` ORDER BY m.\`createdAt\` DESC, m.\`id\` DESC) AS rn
          FROM \`InboxMessage\` m
          INNER JOIN \`WhatsAppInstance\` i ON i.\`id\` = m.\`instanceId\`
          WHERE i.\`userId\` = ${id}
            AND m.\`number\` != 'status'
            AND m.\`number\` COLLATE utf8mb4_unicode_ci NOT LIKE CONVERT('status:%' USING utf8mb4) COLLATE utf8mb4_unicode_ci
            AND m.\`number\` != '0'
        ),
        latest AS (
          SELECT
            \`instanceId\`,
            \`number\`,
            \`contactName\`,
            \`text\`,
            \`type\`,
            \`status\`,
            \`createdAt\`,
            \`instanceName\`
          FROM ranked_messages
          WHERE rn = 1
        ),
        unread AS (
          SELECT
            m.\`instanceId\`,
            m.\`number\`,
            COUNT(*) AS \`unreadCount\`
          FROM \`InboxMessage\` m
          INNER JOIN \`WhatsAppInstance\` i ON i.\`id\` = m.\`instanceId\`
          WHERE i.\`userId\` = ${id}
            AND m.\`type\` = 'RECEIVED'
            AND m.\`status\` != 'READ'
          GROUP BY m.\`instanceId\`, m.\`number\`
        )
        SELECT
          latest.*,
          COALESCE(unread.\`unreadCount\`, 0) AS \`unreadCount\`
        FROM latest
        LEFT JOIN unread
          ON unread.\`instanceId\` = latest.\`instanceId\`
          AND unread.\`number\` = latest.\`number\`
        ORDER BY latest.\`createdAt\` DESC
        LIMIT ${limit}
      `;

      return NextResponse.json({
        user: targetUser,
        chats: chatRows.map(chat => ({
          instanceId: chat.instanceId,
          instanceName: chat.instanceName,
          number: chat.number,
          contactName: chat.contactName || null,
          lastMessage: extractDisplayText(chat.text),
          lastMessageTime: chat.createdAt,
          lastMessageType: chat.type,
          lastMessageStatus: chat.status,
          unreadCount: Number(chat.unreadCount || 0)
        }))
      });
    }

    if (view === 'logs') {
      const skip = Number(searchParams.get('skip') || 0);
      const logs = await prisma.messageLog.findMany({
        where: { instance: { userId: id } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: skip,
        include: { instance: { select: { id: true, name: true } } }
      });

      const totalCount = await prisma.messageLog.count({
        where: { instance: { userId: id } }
      });

      return NextResponse.json({
        user: targetUser,
        totalCount,
        logs: logs.map(log => ({
          ...log,
          text: extractDisplayText(log.text)
        }))
      });
    }

    return NextResponse.json({ error: 'Unsupported view' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin user resource GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin();
    if (!adminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const { action, instanceId } = await request.json();

    if (!instanceId || !['DISCONNECT_INSTANCE', 'DELETE_INSTANCE'].includes(action)) {
      return NextResponse.json({ error: 'Invalid instance action' }, { status: 400 });
    }

    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: instanceId, userId: id }
    });

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found for this user' }, { status: 404 });
    }

    if (action === 'DISCONNECT_INSTANCE') {
      try {
        await whatsapp.logout(instance.token);
      } catch (err) {
        console.warn(`Admin disconnect warning for instance ${instanceId}:`, err);
      }

      const updated = await prisma.whatsAppInstance.update({
        where: { id: instanceId },
        data: { status: 'DISCONNECTED' }
      });

      return NextResponse.json({ message: 'Instance disconnected successfully', instance: updated });
    }

    try {
      await whatsapp.deleteInstance(instance.id);
    } catch (err) {
      console.warn(`Admin delete warning for instance ${instanceId}:`, err);
    }

    await deleteInstanceData(instanceId);

    return NextResponse.json({ message: 'Instance deleted successfully' });
  } catch (error: any) {
    console.error('Admin user resource POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await requireAdmin();
    if (!adminUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;
    const targetUser = await userExists(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target');

    if (target !== 'logs') {
      return NextResponse.json({ error: 'Unsupported delete target' }, { status: 400 });
    }

    const deleted = await prisma.messageLog.deleteMany({
      where: { instance: { userId: id } }
    });

    return NextResponse.json({
      message: 'User message logs deleted successfully',
      deletedCount: deleted.count
    });
  } catch (error: any) {
    console.error('Admin user resource DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
