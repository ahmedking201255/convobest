import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp';
import { deleteInstanceData } from '@/lib/instance-cleanup';
import crypto from 'crypto';

function extractInstanceJid(statusData: any) {
  const jid = statusData?.JID || statusData?.jid || statusData?.myJid || statusData?.MyJid;
  if (!jid) return null;
  if (typeof jid === 'string') return jid;
  const user = jid.User || jid.user;
  const server = jid.Server || jid.server || 's.whatsapp.net';
  return user ? `${user}@${server}` : null;
}

// Get all instances for the logged-in user
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instances = await prisma.whatsAppInstance.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
    });

    // Dynamically check live status and update database accordingly for all retrieved instances
    const updatedInstances = await Promise.all(
      instances.map(async (instance) => {
        if (instance.status === 'CONFLICT') {
          return {
            ...instance,
            status: 'DISCONNECTED'
          };
        }
        try {
          const statusResult = await whatsapp.getStatus(instance.token);
          const isScanned = statusResult.data?.LoggedIn === true;
          const liveJid = extractInstanceJid(statusResult.data);

          if (isScanned && liveJid) {
            const isConflict = await whatsapp.checkConflict(instance.id, user.userId, instance.token, liveJid);
            if (isConflict) {
              return {
                ...instance,
                status: 'DISCONNECTED',
                jid: null
              };
            }
          }

          const liveStatus = isScanned ? 'CONNECTED' : 'DISCONNECTED';
          
          if (instance.status !== liveStatus) {
            const updated = await prisma.whatsAppInstance.update({
              where: { id: instance.id },
              data: {
                status: liveStatus,
                ...(liveJid ? { jid: liveJid } : {})
              },
            });
            return updated;
          } else {
            if (liveJid && instance.jid !== liveJid) {
              const updated = await prisma.whatsAppInstance.update({
                where: { id: instance.id },
                data: { jid: liveJid },
              });
              return updated;
            }
          }
        } catch (err) {
          console.error(`Failed to fetch live status for instance ${instance.id}:`, err);
        }
        return instance;
      })
    );

    return NextResponse.json(updatedInstances);
  } catch (error: any) {
    console.error('Error fetching instances:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create a new WhatsApp Instance
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Get user active subscription and limits
    const subscription = await prisma.subscription.findFirst({
      where: { userId: user.userId, status: 'ACTIVE' },
    });

    if (!subscription && user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'يجب الترقية والاشتراك في إحدى الباقات لتتمكن من إضافة أرقام واتساب.' },
        { status: 403 }
      );
    }

    const currentCount = await prisma.whatsAppInstance.count({
      where: { userId: user.userId },
    });

    // Enforce limits based on subscription tier
    let limit = 1; // Default Free Trial
    if (subscription) {
      if (subscription.plan.toLowerCase().includes('starter')) limit = 1;
      else if (subscription.plan.toLowerCase().includes('pro')) limit = 3;
      else if (subscription.plan.toLowerCase().includes('enterprise')) limit = 10;
    }

    if (currentCount >= limit) {
      return NextResponse.json(
        { error: `لقد وصلت للحد الأقصى المسموح به لخطة اشتراكك وهو (${limit}) رقم/أرقام واتساب. يرجى الترقية لإضافة المزيد.` },
        { status: 403 }
      );
    }

    // Generate random API key (token) for the instance
    const token = crypto.randomBytes(16).toString('hex');
    
    // Generate unique instance ID
    const instanceId = crypto.randomUUID();

    // 1. Create instance in the Go WhatsApp Engine
    const result = await whatsapp.createInstance(instanceId, token);
    const goEngineInstanceId = result.data?.id || result.data?.Id || instanceId;

    // 2. Register instance in our database
    const newInstance = await prisma.whatsAppInstance.create({
      data: {
        id: goEngineInstanceId,
        userId: user.userId,
        name: name,
        token: token,
        status: 'DISCONNECTED',
      },
    });

    return NextResponse.json(newInstance, { status: 201 });
  } catch (error: any) {
    console.error('Error creating instance:', error);
    return NextResponse.json(
      { error: 'Failed to create instance. Ensure the WhatsApp engine is running.', details: error.message },
      { status: 500 }
    );
  }
}

// Delete a WhatsApp Instance
export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Instance ID is required' }, { status: 400 });
    }

    // Verify ownership of the instance
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: id, userId: user.userId },
    });

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found or unauthorized' }, { status: 404 });
    }

    // 1. Delete instance in the Go WhatsApp Engine
    try {
      await whatsapp.deleteInstance(id);
    } catch (engineError) {
      console.warn('Warning: Failed to delete instance on the Go engine. It might have been already deleted.', engineError);
    }

    // 2. Delete every portal record owned by this WhatsApp instance.
    await deleteInstanceData(id);

    return NextResponse.json({ message: 'Instance deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting instance:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
