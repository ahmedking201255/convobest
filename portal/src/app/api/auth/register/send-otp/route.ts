import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { whatsapp } from '@/lib/whatsapp';
import { otpStore } from '@/lib/otp-store';
import { getSystemSettings } from '@/lib/system-settings';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    
    if (!phone) {
      return NextResponse.json({ error: 'رقم الهاتف مطلوب' }, { status: 400 });
    }
    
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      return NextResponse.json({ error: 'رقم الهاتف غير صالح' }, { status: 400 });
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanPhone }
    });
    
    if (existingUser) {
      return NextResponse.json({ error: 'رقم الهاتف هذا مسجل بالفعل. يرجى تسجيل الدخول.' }, { status: 400 });
    }
    
    // Generate 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Persist the code so verification works across Passenger workers and restarts.
    await otpStore.set(cleanPhone, code);
    
    // Find the OTP sender instance from system settings
    const settings = getSystemSettings();
    let instance = null;

    if (settings.otpSenderInstanceId) {
      instance = await prisma.whatsAppInstance.findFirst({
        where: {
          id: settings.otpSenderInstanceId,
          status: 'CONNECTED'
        }
      });
    }

    // Fallback if not configured or not connected
    if (!instance) {
      instance = await prisma.whatsAppInstance.findFirst({
        where: {
          OR: [
            { jid: { startsWith: '201011198155' } },
            { token: '2e13654f07310293b5faaa7e142b92aa' }
          ],
          status: 'CONNECTED'
        }
      });
    }
    
    let sentSuccessfully = false;
    let sendError = '';
    
    if (instance) {
      try {
        const messageText = `رمز التحقق الخاص بك لتسجيل حساب جديد في ConvoBest هو: *${code}*\nكود التحقق صالح لمدة 10 دقائق.`;
        await whatsapp.sendText(instance.token, cleanPhone, messageText);
        sentSuccessfully = true;
      } catch (err: any) {
        console.error('[Send OTP Error]:', err.message);
        sendError = err.message || 'فشل إرسال رسالة الواتساب';
      }
    } else {
      console.warn('[Send OTP Warning]: System instance 201011198155 is not connected/found in DB.');
      sendError = 'رقم الإرسال الخاص بالمنصة غير متصل حالياً بالإنترنت';
    }

    if (!sentSuccessfully) {
      await otpStore.delete(cleanPhone);
      return NextResponse.json(
        { error: 'تعذر إرسال رمز التحقق عبر واتساب. يرجى المحاولة مرة أخرى.', details: sendError },
        { status: 503 },
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم إرسال رمز التحقق OTP بنجاح عبر واتساب',
    });
    
  } catch (error: any) {
    console.error('Error sending register OTP:', error);
    return NextResponse.json({ error: 'حدث خطأ داخلي في الخادم', details: error.message }, { status: 500 });
  }
}
