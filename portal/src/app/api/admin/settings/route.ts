import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { getSystemSettings, saveSystemSettings } from '@/lib/system-settings';

// GET: Retrieve current system settings & list of admin connected instances
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const settings = getSystemSettings();

    // Find all connected instances belonging to admins
    const adminInstances = await prisma.whatsAppInstance.findMany({
      where: {
        status: 'CONNECTED',
        user: { role: 'ADMIN' }
      },
      select: {
        id: true,
        name: true,
        jid: true
      }
    });

    const formattedInstances = adminInstances.map(inst => {
      // Clean JID to readable number
      const number = inst.jid ? inst.jid.split('@')[0].split(':')[0] : 'غير معروف';
      return {
        id: inst.id,
        name: inst.name,
        number
      };
    });

    return NextResponse.json({
      settings,
      instances: formattedInstances
    });

  } catch (error: any) {
    console.error('Error fetching admin settings:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

// POST: Save system settings
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { otpSenderInstanceId } = await request.json();

    // Verify instance if provided
    if (otpSenderInstanceId) {
      const instanceExists = await prisma.whatsAppInstance.findUnique({
        where: { id: otpSenderInstanceId }
      });
      if (!instanceExists) {
        return NextResponse.json({ error: 'رقم الإرسال المختار غير موجود بالنظام' }, { status: 400 });
      }
    }

    saveSystemSettings({ otpSenderInstanceId });

    return NextResponse.json({
      success: true,
      message: 'تم حفظ إعدادات النظام بنجاح'
    });

  } catch (error: any) {
    console.error('Error saving admin settings:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
