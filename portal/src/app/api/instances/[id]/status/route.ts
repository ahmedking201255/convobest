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

    // Verify ownership
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: id, userId: user.userId },
    });

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found or unauthorized' }, { status: 404 });
    }

    if (instance.status === 'CONFLICT') {
      return NextResponse.json({
        status: 'DISCONNECTED',
        error: 'هذا الرقم مربوط بالفعل بحساب آخر على المنصة. لا يمكن ربطه بأكثر من حساب.'
      });
    }

    // Fetch live status from the Go WhatsApp Engine
    const statusResult = await whatsapp.getStatus(instance.token);
    
    // Update local database status accordingly
    // In some systems, Connected means WebSocket/TCP, and LoggedIn means scanned.
    const isScanned = statusResult.data.LoggedIn === true;
    let newStatus = isScanned ? 'CONNECTED' : 'DISCONNECTED';
    const liveJid = extractInstanceJid(statusResult.data);

    if (isScanned && liveJid) {
      const isConflict = await whatsapp.checkConflict(id, user.userId, instance.token, liveJid);
      if (isConflict) {
        newStatus = 'DISCONNECTED';
        return NextResponse.json({
          status: 'DISCONNECTED',
          error: 'هذا الرقم مربوط بالفعل بحساب آخر على المنصة. لا يمكن ربطه بأكثر من حساب.',
          liveData: { ...statusResult.data, LoggedIn: false }
        });
      }
    }

    if (instance.status !== newStatus || (liveJid && instance.jid !== liveJid)) {
      await prisma.whatsAppInstance.update({
        where: { id: id },
        data: {
          status: newStatus,
          ...(liveJid ? { jid: liveJid } : {})
        },
      });
    }

    if (isScanned && instance.status !== 'CONNECTED') {
      syncContactsWithRetry(id, instance.token, { requestHistorySync: true });
    }

    return NextResponse.json({
      status: newStatus,
      liveData: statusResult.data,
    });
  } catch (error: any) {
    console.error('Error fetching status:', error);
    // If Go engine fails, fallback to last known DB status
    const dbInstance = await prisma.whatsAppInstance.findUnique({
      where: { id: context.params ? (await context.params).id : '' },
    });

    return NextResponse.json({
      status: dbInstance?.status || 'DISCONNECTED',
      error: 'Failed to fetch live status from the engine.',
    });
  }
}
