import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('session_token');

    if (!tokenCookie || !tokenCookie.value) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    const decoded = verifyToken(tokenCookie.value);
    if (!decoded) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    // Fetch user details + latest subscription from DB (ordered by endDate desc)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        subscriptions: {
          orderBy: { endDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    let activeSubscription = null;

    if (user.subscriptions.length > 0) {
      const latestSub = user.subscriptions[0];
      
      // If subscription is ACTIVE but its end date is in the past, handle expiration
      if (latestSub.status === 'ACTIVE' && latestSub.endDate < new Date()) {
        console.log(`[Subscription Expiration Check] User ${user.id} subscription (${latestSub.plan}) expired on ${latestSub.endDate}. Disconnecting WhatsApp instances.`);
        
        // 1. Update subscription status to EXPIRED
        await prisma.subscription.update({
          where: { id: latestSub.id },
          data: { status: 'EXPIRED' }
        });
        
        // 2. Find all CONNECTED WhatsApp instances of this user
        const connectedInstances = await prisma.whatsAppInstance.findMany({
          where: {
            userId: user.id,
            status: 'CONNECTED'
          }
        });
        
        // 3. Disconnect them from the Go WhatsApp Engine
        for (const inst of connectedInstances) {
          try {
            await whatsapp.logout(inst.token);
          } catch (err: any) {
            console.error(`[Subscription Expiration] Failed to logout instance ${inst.id} from Go engine:`, err.message);
          }
        }
        
        // 4. Update all instances to DISCONNECTED in DB
        await prisma.whatsAppInstance.updateMany({
          where: {
            userId: user.id,
            status: 'CONNECTED'
          },
          data: {
            status: 'DISCONNECTED',
            jid: null
          }
        });
        
        latestSub.status = 'EXPIRED';
      }

      if (latestSub.status === 'ACTIVE') {
        activeSubscription = latestSub;
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        subscription: activeSubscription,
      },
    });
  } catch (error: any) {
    console.error('Session error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
