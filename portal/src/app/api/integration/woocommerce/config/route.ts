import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import crypto from 'crypto';

// GET the WooCommerce configuration for an instance
export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');

    if (!instanceId) {
      return NextResponse.json({ error: 'معرف الحساب (instanceId) مطلوب' }, { status: 400 });
    }

    // Verify ownership of the instance
    const instance = await prisma.whatsAppInstance.findFirst({
      where: {
        id: instanceId,
        userId: user.userId
      }
    });

    if (!instance) {
      return NextResponse.json({ error: 'الحساب غير موجود أو لا تملكه' }, { status: 404 });
    }

    // Fetch config, or create a default one if it doesn't exist
    let config = await prisma.wooCommerceConfig.findUnique({
      where: { instanceId }
    });

    if (!config) {
      config = await prisma.wooCommerceConfig.create({
        data: {
          instanceId,
          apiKey: crypto.randomUUID(),
          enabled: false
        }
      });
    }

    return NextResponse.json({ config });
  } catch (error: any) {
    console.error('Fetch WooCommerce config error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء تحميل إعدادات ووكومرس', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Update the WooCommerce configuration
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { 
      instanceId, 
      enabled, 
      orderCreatedTemplate, 
      orderProcessingTemplate, 
      orderCompletedTemplate,
      regenerateApiKey 
    } = await request.json();

    if (!instanceId) {
      return NextResponse.json({ error: 'معرف الحساب (instanceId) مطلوب' }, { status: 400 });
    }

    // Verify ownership of the instance
    const instance = await prisma.whatsAppInstance.findFirst({
      where: {
        id: instanceId,
        userId: user.userId
      }
    });

    if (!instance) {
      return NextResponse.json({ error: 'الحساب غير موجود أو لا تملكه' }, { status: 404 });
    }

    const updateData: any = {
      enabled: enabled !== undefined ? enabled : false
    };

    if (orderCreatedTemplate !== undefined) updateData.orderCreatedTemplate = orderCreatedTemplate;
    if (orderProcessingTemplate !== undefined) updateData.orderProcessingTemplate = orderProcessingTemplate;
    if (orderCompletedTemplate !== undefined) updateData.orderCompletedTemplate = orderCompletedTemplate;
    if (regenerateApiKey) updateData.apiKey = crypto.randomUUID();

    const config = await prisma.wooCommerceConfig.upsert({
      where: { instanceId },
      update: updateData,
      create: {
        instanceId,
        apiKey: crypto.randomUUID(),
        enabled: enabled !== undefined ? enabled : false,
        orderCreatedTemplate: orderCreatedTemplate || undefined,
        orderProcessingTemplate: orderProcessingTemplate || undefined,
        orderCompletedTemplate: orderCompletedTemplate || undefined
      }
    });

    return NextResponse.json({ config, message: 'تم حفظ إعدادات ووكومرس بنجاح' });
  } catch (error: any) {
    console.error('Save WooCommerce config error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء حفظ الإعدادات', details: error.message },
      { status: 500 }
    );
  }
}
