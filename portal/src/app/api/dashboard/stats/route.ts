import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { extractDisplayText } from '@/lib/message-display';

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Count instances
    const totalInstances = await prisma.whatsAppInstance.count({
      where: { userId: user.userId },
    });

    const activeInstances = await prisma.whatsAppInstance.count({
      where: { userId: user.userId, status: 'CONNECTED' },
    });

    // 2. Count messages
    const messagesSent = await prisma.messageLog.count({
      where: { 
        instance: { userId: user.userId },
        type: 'SENT'
      },
    });

    const messagesReceived = await prisma.messageLog.count({
      where: { 
        instance: { userId: user.userId },
        type: 'RECEIVED'
      },
    });

    // 3. Fetch recent 5 logs
    const recentLogs = await prisma.messageLog.findMany({
      where: {
        instance: { userId: user.userId }
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        instance: {
          select: { name: true }
        }
      }
    });

    return NextResponse.json({
      stats: {
        totalInstances,
        activeInstances,
        messagesSent,
        messagesReceived,
      },
      recentLogs: recentLogs.map(log => ({
        id: log.id,
        instanceName: log.instance.name,
        number: log.number,
        text: extractDisplayText(log.text),
        type: log.type,
        createdAt: log.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
