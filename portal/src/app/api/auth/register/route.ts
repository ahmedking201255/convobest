import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { otpStore } from '@/lib/otp-store';

export async function POST(request: Request) {
  try {
    const { phone, password, name, otpCode } = await request.json();

    if (!phone || !password || !otpCode) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة بما فيها رقم الهاتف وكلمة المرور وكود التحقق' },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      return NextResponse.json({ error: 'رقم الهاتف غير صالح' }, { status: 400 });
    }

    // Check if user already exists (mapped phone to email)
    const email = cleanPhone;
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      await otpStore.delete(cleanPhone);
      return NextResponse.json(
        { error: 'الحساب مسجل بالفعل، يرجى تسجيل الدخول.' },
        { status: 400 }
      );
    }

    const isOtpValid = await otpStore.verify(cleanPhone, String(otpCode).trim());
    if (!isOtpValid) {
      return NextResponse.json(
        { error: 'كود التحقق OTP غير صحيح أو منتهي الصلاحية' },
        { status: 400 }
      );
    }

    // Hash the password and create the user
    const hashedPassword = hashPassword(password);
    
    // Create User and default Subscription in a transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name: name || null,
        },
      });

      // Default Free Trial (3 Days)
      const now = new Date();
      const endDate = new Date();
      endDate.setDate(now.getDate() + 3);

      await tx.subscription.create({
        data: {
          userId: newUser.id,
          plan: 'Starter (Trial)',
          status: 'ACTIVE',
          startDate: now,
          endDate: endDate,
        },
      });

      await tx.registrationOtp.deleteMany({ where: { phone: cleanPhone } });

      return newUser;
    });

    return NextResponse.json(
      { message: 'User registered successfully', userId: user.id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
