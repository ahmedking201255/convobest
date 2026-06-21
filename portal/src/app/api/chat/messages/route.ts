import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');
    const number = searchParams.get('number');
    const rawLimit = Number(searchParams.get('limit') || 50);
    const rawOffset = Number(searchParams.get('offset') || 0);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 50, 1), 100);
    const offset = Math.max(Number.isFinite(rawOffset) ? rawOffset : 0, 0);
    const take = limit + 1;

    if (!instanceId || !number) {
      return NextResponse.json({ error: 'معرف الحساب (instanceId) ورقم الهاتف مطلوبان' }, { status: 400 });
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

    const rows = await prisma.inboxMessage.findMany({
      where: {
        instanceId,
        number
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' }
      ],
      take,
      skip: offset
    });

    const hasMore = rows.length > limit;
    const messages = rows.slice(0, limit).reverse();

    return NextResponse.json({
      messages,
      pagination: {
        limit,
        offset,
        nextOffset: offset + messages.length,
        hasMore
      }
    });
  } catch (error: any) {
    console.error('Fetch chat messages error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء تحميل سجل الرسائل للمحادثة', details: error.message },
      { status: 500 }
    );
  }
}
