import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { whatsapp } from '@/lib/whatsapp';
import { messageQuotaErrorResponse, sendWithMessageQuota } from '@/lib/message-quota';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, orderId, status, customerName, customerPhone, total, currency } = body;

    if (!apiKey) {
      return NextResponse.json({ error: 'مفتاح الربط (apiKey) مطلوب' }, { status: 400 });
    }

    // Find config using apiKey
    const config = await prisma.wooCommerceConfig.findUnique({
      where: { apiKey },
      include: {
        instance: true
      }
    });

    if (!config) {
      return NextResponse.json({ error: 'مفتاح الربط غير صالح أو التكوين غير موجود' }, { status: 404 });
    }

    if (!config.enabled) {
      return NextResponse.json({ success: false, message: 'التكامل مع ووكومرس غير نشط حالياً لهذا الحساب' });
    }

    // Verify WhatsAppInstance connection status
    const instance = config.instance;
    if (!instance) {
      return NextResponse.json({ error: 'جلسة الواتساب المربوطة غير موجودة' }, { status: 404 });
    }

    if (instance.status !== 'CONNECTED') {
      return NextResponse.json({ error: 'جلسة الواتساب غير متصلة بالإنترنت حالياً' }, { status: 400 });
    }

    // Select the correct template based on order status
    let template = '';
    const cleanStatus = (status || '').toLowerCase().trim();

    if (cleanStatus === 'pending' || cleanStatus === 'created') {
      template = config.orderCreatedTemplate;
    } else if (cleanStatus === 'processing') {
      template = config.orderProcessingTemplate;
    } else if (cleanStatus === 'completed') {
      template = config.orderCompletedTemplate;
    } else {
      // Default to created template if status is not matched but webhook fired
      template = config.orderCreatedTemplate;
    }

    if (!template) {
      return NextResponse.json({ success: true, message: 'لا توجد صياغة قالب محددة لهذه الحالة، تم التخطي.' });
    }

    // Format the message template
    let messageText = template
      .replace(/{customer_name}/g, customerName || '')
      .replace(/{order_id}/g, orderId || '')
      .replace(/{order_total}/g, total || '')
      .replace(/{currency}/g, currency || 'EGP');

    // Clean phone number (remove spacing, non-digits, leading zeros)
    let cleanPhone = (customerPhone || '').replace(/\D/g, '');
    if (!cleanPhone) {
      return NextResponse.json({ error: 'رقم هاتف العميل غير صالح' }, { status: 400 });
    }

    // Send via Go Engine
    const result = await sendWithMessageQuota(instance.userId, () => whatsapp.sendText(instance.token, cleanPhone, messageText));

    // Log the message to the database
    await prisma.messageLog.create({
      data: {
        instanceId: instance.id,
        number: cleanPhone,
        text: messageText,
        type: 'SENT'
      }
    });

    return NextResponse.json({ success: true, message: 'تم إرسال إشعار ووكومرس بنجاح', result });
  } catch (error: any) {
    console.error('WooCommerce integration error:', error);
    const quotaError = messageQuotaErrorResponse(error);
    if (quotaError) return NextResponse.json(quotaError, { status: 429 });
    return NextResponse.json(
      { error: 'حدث خطأ في معالجة إشعار ووكومرس', details: error.message },
      { status: 500 }
    );
  }
}
