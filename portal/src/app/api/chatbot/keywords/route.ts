import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

// GET all keyword rules for an instance
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

    const rules = await prisma.keywordRule.findMany({
      where: { instanceId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ rules });
  } catch (error: any) {
    console.error('Fetch keyword rules error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء تحميل قواعد الكلمات المفتاحية', details: error.message },
      { status: 500 }
    );
  }
}

// POST: Create or Update a keyword rule
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { id, instanceId, keyword, matchType, replyText, enabled } = await request.json();

    if (!instanceId || !keyword || !replyText) {
      return NextResponse.json({ error: 'جميع الحقول الأساسية مطلوبة (الكلمة، النص المستهدف، الرد)' }, { status: 400 });
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

    let rule;

    if (id) {
      // Update existing rule
      rule = await prisma.keywordRule.update({
        where: { id },
        data: {
          keyword: keyword.trim(),
          matchType: matchType || 'CONTAINS',
          replyText: replyText.trim(),
          enabled: enabled !== undefined ? enabled : true
        }
      });
    } else {
      // Create new rule
      rule = await prisma.keywordRule.create({
        data: {
          instanceId,
          keyword: keyword.trim(),
          matchType: matchType || 'CONTAINS',
          replyText: replyText.trim(),
          enabled: enabled !== undefined ? enabled : true
        }
      });
    }

    return NextResponse.json({ rule, message: 'تم حفظ القاعدة بنجاح' });
  } catch (error: any) {
    console.error('Save keyword rule error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء حفظ قاعدة الكلمات المفتاحية', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete a keyword rule
export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'معرف القاعدة مطلوب' }, { status: 400 });
    }

    // Find the rule and ensure the user owns the associated instance
    const rule = await prisma.keywordRule.findUnique({
      where: { id },
      include: {
        instance: true
      }
    });

    if (!rule || rule.instance.userId !== user.userId) {
      return NextResponse.json({ error: 'القاعدة غير موجودة أو لا تملك صلاحية حذفها' }, { status: 404 });
    }

    await prisma.keywordRule.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'تم حذف قاعدة الكلمة المفتاحية بنجاح' });
  } catch (error: any) {
    console.error('Delete keyword rule error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء حذف قاعدة الكلمة المفتاحية', details: error.message },
      { status: 500 }
    );
  }
}
