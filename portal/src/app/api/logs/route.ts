import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { extractDisplayText } from '@/lib/message-display';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;
    const instanceId = searchParams.get('instanceId') || undefined;
    const number = searchParams.get('number') || undefined;
    const search = searchParams.get('search') || undefined;
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;

    // Build Prisma query condition
    const whereCondition: any = {
      instance: {
        userId: user.userId, // Only fetch logs of instances owned by the user
      },
    };

    if (type && type !== 'ALL') {
      whereCondition.type = type;
    }

    if (instanceId && instanceId !== 'ALL') {
      whereCondition.instanceId = instanceId;
    }

    if (number) {
      whereCondition.number = {
        contains: number,
      };
    }

    if (search) {
      whereCondition.text = {
        contains: search,
      };
    }

    // Get total count for pagination
    const totalCount = await prisma.messageLog.count({
      where: whereCondition,
    });

    // Get message logs
    const logs = await prisma.messageLog.findMany({
      where: whereCondition,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
      include: {
        instance: {
          select: {
            name: true,
            id: true,
          },
        },
      },
    });

    return NextResponse.json({
      logs: logs.map((log) => ({
        ...log,
        text: extractDisplayText(log.text),
      })),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    console.error('Fetch logs API error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء تحميل سجل الرسائل', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE endpoint to clear all logs for a user
export async function DELETE(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    // Delete all logs associated with instances owned by the user
    const deleteResult = await prisma.messageLog.deleteMany({
      where: {
        instance: {
          userId: user.userId,
        },
      },
    });

    return NextResponse.json({
      message: 'تم تفريغ سجل الرسائل بنجاح',
      deletedCount: deleteResult.count,
    });
  } catch (error: any) {
    console.error('Clear logs API error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء تفريغ سجل الرسائل', details: error.message },
      { status: 500 }
    );
  }
}
