import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { whatsapp } from '@/lib/whatsapp';
import { getSystemSettings } from '@/lib/system-settings';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

    if (!phone) {
      return NextResponse.json(
        { error: 'رقم الهاتف مطلوب' },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      return NextResponse.json(
        { error: 'رقم الهاتف غير صالح' },
        { status: 400 }
      );
    }

    // Find the user (phone is stored in email field)
    const user = await prisma.user.findUnique({
      where: { email: cleanPhone },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'رقم الهاتف هذا غير مسجل لدينا' },
        { status: 404 }
      );
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Expiration: 15 minutes from now
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000);

    // Save to user model
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode,
        otpExpires,
      },
    });

    // Save to local scratch file for easy testing/developer retrieval
    try {
      const scratchDir = path.join(process.cwd(), 'scratch');
      if (!fs.existsSync(scratchDir)) {
        fs.mkdirSync(scratchDir, { recursive: true });
      }
      fs.writeFileSync(path.join(scratchDir, 'last_otp.txt'), `Phone: ${cleanPhone}\nOTP: ${otpCode}\nGeneratedAt: ${new Date().toISOString()}`);
      console.log(`[FORGOT PASSWORD OTP] Phone: ${cleanPhone} -> OTP: ${otpCode}`);
    } catch (fsErr) {
      console.error('Failed to write OTP to scratch file:', fsErr);
    }

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
        const messageText = `رمز إعادة تعيين كلمة المرور (OTP) الخاص بك في ConvoBest هو: *${otpCode}*\nصالح لمدة 15 دقيقة.`;
        await whatsapp.sendText(instance.token, cleanPhone, messageText);
        sentSuccessfully = true;
      } catch (err: any) {
        console.error('[Forgot Password OTP Send Error]:', err.message);
        sendError = err.message || 'فشل إرسال رسالة الواتساب';
      }
    } else {
      console.warn('[Forgot Password OTP Warning]: System instance 201011198155 is not connected.');
      sendError = 'رقم الإرسال الخاص بالمنصة غير متصل حالياً بالإنترنت';
    }

    return NextResponse.json(
      { 
        message: sentSuccessfully 
          ? 'تم إرسال رمز التحقق OTP بنجاح عبر الواتساب' 
          : `تم توليد الرمز بنجاح بالخلفية (تنبيه: ${sendError})`
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما في الخادم', details: error.message },
      { status: 500 }
    );
  }
}
