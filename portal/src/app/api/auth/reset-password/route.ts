import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, phone, otpCode, password } = await request.json();
    const identifier = phone ? phone.replace(/\D/g, '') : email;

    if (!identifier || !otpCode || !password) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة (رقم الهاتف، رمز OTP، كلمة المرور الجديدة)' },
        { status: 400 }
      );
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: identifier },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      );
    }

    // Check if OTP exists
    if (!user.otpCode) {
      return NextResponse.json(
        { error: 'لم يتم طلب رمز تحقق لهذا البريد الإلكتروني أو تم استخدامه بالفعل' },
        { status: 400 }
      );
    }

    // Check if OTP matches
    if (user.otpCode !== otpCode.trim()) {
      return NextResponse.json(
        { error: 'رمز التحقق OTP غير صحيح' },
        { status: 400 }
      );
    }

    // Check expiration
    if (user.otpExpires && new Date() > user.otpExpires) {
      return NextResponse.json(
        { error: 'انتهت صلاحية رمز التحقق OTP، يرجى طلب رمز جديد' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = hashPassword(password);

    // Update user password and clear OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        otpCode: null,
        otpExpires: null,
      },
    });

    return NextResponse.json(
      { message: 'تم إعادة تعيين كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة.' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما في الخادم', details: error.message },
      { status: 500 }
    );
  }
}
