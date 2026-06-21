import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { whatsapp } from '@/lib/whatsapp';
import { messageQuotaErrorResponse, sendWithMessageQuota } from '@/lib/message-quota';

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
        return NextResponse.json({ error: 'يجب الترقية والاشتراك في إحدى الباقات لتتمكن من إرسال رسائل.' }, { status: 403 });
      }
    }

    // Check if the instance is connected
    if (instance.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'يجب أن يكون رقم الواتساب متصلاً لإرسال رسالة تجريبية.' }, { status: 400 });
    }

    const { number, text } = await request.json();

    if (!number || !text) {
      return NextResponse.json({ error: 'رقم الهاتف ونص الرسالة مطلوبان.' }, { status: 400 });
    }

    // Send text message via Go Engine
    const cleanNumber = number.replace(/\D/g, ''); // strip non-numeric characters
    const result = await sendWithMessageQuota(instance.userId, () => whatsapp.sendText(instance.token, cleanNumber, text));

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Error sending test message:', error);
    const quotaError = messageQuotaErrorResponse(error);
    if (quotaError) return NextResponse.json(quotaError, { status: 429 });
    return NextResponse.json(
      { error: 'فشل إرسال الرسالة التجريبية.', details: error.message },
      { status: 500 }
    );
  }
}
