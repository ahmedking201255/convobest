import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp';

export async function POST(
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

    // Call logout in the Go WhatsApp Engine
    try {
      await whatsapp.logout(instance.token);
    } catch (logoutError) {
      console.warn('Go engine logout warning:', logoutError);
    }

    // Update database status
    const updatedInstance = await prisma.whatsAppInstance.update({
      where: { id: id },
      data: { status: 'DISCONNECTED' },
    });

    return NextResponse.json(updatedInstance);
  } catch (error: any) {
    console.error('Error logging out instance:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
