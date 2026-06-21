import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getCurrentUsagePeriod } from '@/lib/message-quota';
import { getMonthlyMessageLimit } from '@/lib/subscription-access';

// GET: List all users with their subscriptions and instance counts
export async function GET() {
  try {
    const adminUser = await getSessionUser();
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const period = getCurrentUsagePeriod();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: {
          select: { instances: true }
        },
        instances: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        subscriptions: {
          orderBy: { endDate: 'desc' },
          take: 1,
          select: {
            id: true,
            plan: true,
            status: true,
            startDate: true,
            endDate: true
          }
        },
        monthlyMessageUsages: {
          where: { period },
          select: { sentCount: true }
        }
      }
    });

    // Aggregate message counts using the same user-instance relationship logic as logs
    const logCounts = await prisma.messageLog.groupBy({
      by: ['instanceId', 'type'],
      where: {
        instance: {
          userId: { in: users.map(u => u.id) }
        }
      },
      _count: {
        _all: true
      }
    });

    // Map stats back to users
    const userStats: Record<string, { sent: number; received: number }> = {};
    users.forEach(u => {
      userStats[u.id] = { sent: 0, received: 0 };
    });

    logCounts.forEach(item => {
      const ownerUser = users.find(u => u.instances.some(i => i.id === item.instanceId));
      if (ownerUser) {
        const count = item._count._all || 0;
        if (item.type === 'SENT') {
          userStats[ownerUser.id].sent += count;
        } else if (item.type === 'RECEIVED') {
          userStats[ownerUser.id].received += count;
        }
      }
    });

    const formattedUsers = users.map(u => {
      const plan = u.subscriptions[0]?.plan || null;
      const limit = getMonthlyMessageLimit(plan);
      // u.monthlyMessageUsages will be typed as any or we can access it safely
      const used = (u as any).monthlyMessageUsages?.[0]?.sentCount || 0;
      const remaining = Math.max(limit - used, 0);

      return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt,
        instancesCount: u._count.instances,
        instances: u.instances,
        subscription: u.subscriptions[0] || null,
        messagesSent: userStats[u.id]?.sent || 0,
        messagesReceived: userStats[u.id]?.received || 0,
        usageLimit: limit,
        usageUsed: used,
        usageRemaining: remaining
      };
    });

    return NextResponse.json({ users: formattedUsers });
  } catch (error: any) {
    console.error('Error fetching admin users list:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// PUT: Update a user's subscription or role
export async function PUT(request: Request) {
  try {
    const adminUser = await getSessionUser();
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, name, email, role, subscription } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. Update user role/name/email if provided
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    // 2. Update subscription if provided
    if (subscription) {
      const { plan, status, endDate } = subscription;
      
      // Find latest subscription
      const existingSub = await prisma.subscription.findFirst({
        where: { userId },
        orderBy: { endDate: 'desc' }
      });

      if (existingSub) {
        await prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            plan: plan || existingSub.plan,
            status: status || existingSub.status,
            endDate: endDate ? new Date(endDate) : existingSub.endDate
          }
        });
      } else {
        // Create new subscription
        const now = new Date();
        const futureDate = endDate ? new Date(endDate) : new Date();
        if (!endDate) futureDate.setDate(now.getDate() + 30); // Default 30 days

        await prisma.subscription.create({
          data: {
            userId,
            plan: plan || 'Starter (Trial)',
            status: status || 'ACTIVE',
            startDate: now,
            endDate: futureDate
          }
        });
      }
    }

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error: any) {
    console.error('Error updating user as admin:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// DELETE: Delete a user and cascade all assets (instances, logs, subscriptions)
export async function DELETE(request: Request) {
  try {
    const adminUser = await getSessionUser();
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Prevent deleting oneself
    if (userId === adminUser.userId) {
      return NextResponse.json({ error: 'You cannot delete your own admin account' }, { status: 400 });
    }

    // Fetch user instances first to delete them from the messaging engine if connected/exists
    const instances = await prisma.whatsAppInstance.findMany({
      where: { userId }
    });

    // Note: To fully clean up, we should delete them from the messaging engine.
    // However, evolution-go engine deletes itself on logout or disconnect.
    // Let's call evolution-go logout API or delete API for each instance to be safe.
    for (const inst of instances) {
      try {
        await fetch(`http://localhost:8080/instance/logout/${inst.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': process.env.GLOBAL_API_KEY || '429683C4C977415CAAFCCE10F7D57E11'
          }
        });
        await fetch(`http://localhost:8080/instance/delete/${inst.id}`, {
          method: 'DELETE',
          headers: {
            'apikey': process.env.GLOBAL_API_KEY || '429683C4C977415CAAFCCE10F7D57E11'
          }
        });
      } catch (err) {
        console.error(`Failed to delete instance ${inst.id} from Go engine during user deletion:`, err);
      }
    }

    // Delete the user from Postgres (Cascade deletes subscription, instances and logs via schema definition)
    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({ message: 'User and all related assets deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
