import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp';
import { syncContactsWithRetry } from '@/lib/whatsapp-sync';

function extractInstanceJid(statusData: any) {
  const jid = statusData?.JID || statusData?.jid || statusData?.myJid || statusData?.MyJid;
  if (!jid) return null;
  if (typeof jid === 'string') return jid;
  const user = jid.User || jid.user;
  const server = jid.Server || jid.server || 's.whatsapp.net';
  return user ? `${user}@${server}` : null;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    // Verify ownership of the instance
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: id, userId: user.userId },
    });

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found or unauthorized' }, { status: 404 });
    }

    // Verify subscription status for non-admin users
    if (user.role !== 'ADMIN') {
      const activeSub = await prisma.subscription.findFirst({
        where: { userId: user.userId, status: 'ACTIVE' }
      });
      if (!activeSub) {
        return NextResponse.json({ error: 'يجب الترقية والاشتراك في إحدى الباقات لتتمكن من توليد رمز QR وربط الواتساب.' }, { status: 403 });
      }
    }

    // Reset status if it was in CONFLICT
    if (instance.status === 'CONFLICT') {
      await prisma.whatsAppInstance.update({
        where: { id: id },
        data: { status: 'DISCONNECTED' }
      });
    }

    // 1. Trigger connect to initialize WhatsApp Web connection
    const portalBaseUrl = process.env.NEXT_PUBLIC_PORTAL_URL || process.env.PORTAL_URL || 'https://convobest.com';
    const webhookUrl = `${portalBaseUrl}/api/webhooks/whatsapp`;
    const subscribe = ["MESSAGE", "READ_RECEIPT", "CONNECTION", "HISTORY_SYNC", "GROUP"];

    // Do not show a QR code unless the engine has persisted the webhook and
    // subscriptions. Otherwise pairing can appear successful while no events
    // or history ever reach the inbox.
    await whatsapp.connect(instance.token, webhookUrl, subscribe);

    // 2. Fetch the QR code. If the scan already completed, the engine returns
    // "session already logged in"; treat that as a successful connection.
    let qrResult;
    try {
      let lastQrError: any;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          qrResult = await whatsapp.getQR(instance.token);
          break;
        } catch (qrAttemptError: any) {
          lastQrError = qrAttemptError;
          const attemptMessage = String(qrAttemptError?.message || '').toLowerCase();
          if (!attemptMessage.includes('no qr code available')) {
            throw qrAttemptError;
          }
          await delay(1200);
        }
      }
      if (!qrResult) throw lastQrError;
    } catch (qrError: any) {
      const message = String(qrError?.message || '').toLowerCase();
      if (message.includes('already logged in') || message.includes('already connected')) {
        const statusResult = await whatsapp.getStatus(instance.token);
        const liveJid = extractInstanceJid(statusResult.data);
        await prisma.whatsAppInstance.update({
          where: { id },
          data: {
            status: 'CONNECTED',
            ...(liveJid ? { jid: liveJid } : {})
          }
        });

        syncContactsWithRetry(id, instance.token, { requestHistorySync: true });

        return NextResponse.json({
          status: 'CONNECTED',
          alreadyConnected: true,
          liveData: statusResult.data
        });
      }
      throw qrError;
    }

    return NextResponse.json(qrResult.data);
  } catch (error: any) {
    console.error('Error fetching QR code:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve QR code. Ensure the session is not already connected.', details: error.message },
      { status: 500 }
    );
  }
}
