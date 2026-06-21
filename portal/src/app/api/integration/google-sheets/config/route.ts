import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { GOOGLE_SHEETS_UPGRADE_MESSAGE, userCanUseGoogleSheets } from '@/lib/subscription-access';

export async function GET(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    if (!(await userCanUseGoogleSheets(user.userId))) {
      return NextResponse.json({ error: GOOGLE_SHEETS_UPGRADE_MESSAGE, upgradeRequired: true }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');

    if (!instanceId) {
      return NextResponse.json({ error: 'معرف الحساب (instanceId) مطلوب' }, { status: 400 });
    }

    // Verify ownership
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: instanceId, userId: user.userId }
    });

    if (!instance) {
      return NextResponse.json({ error: 'الحساب غير موجود أو لا تملكه' }, { status: 404 });
    }

    let config = await prisma.googleSheetsConfig.findUnique({
      where: { instanceId }
    });

    if (!config) {
      config = await prisma.googleSheetsConfig.create({
        data: {
          instanceId,
          enabled: false
        }
      });
    }

    const isConnected = !!(config.accessToken && config.refreshToken);

    return NextResponse.json({
      config: {
        id: config.id,
        instanceId: config.instanceId,
        spreadsheetId: config.spreadsheetId,
        spreadsheetName: config.spreadsheetName,
        sheetName: config.sheetName,
        columnMapping: config.columnMapping,
        enabled: config.enabled,
        isConnected
      }
    });
  } catch (error: any) {
    console.error('Fetch Google Sheets config error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء تحميل إعدادات جوجل شيتس', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
    }

    if (!(await userCanUseGoogleSheets(user.userId))) {
      return NextResponse.json({ error: GOOGLE_SHEETS_UPGRADE_MESSAGE, upgradeRequired: true }, { status: 403 });
    }

    const { 
      instanceId, 
      enabled, 
      spreadsheetId, 
      spreadsheetName, 
      sheetName, 
      columnMapping,
      disconnect
    } = await request.json();

    if (!instanceId) {
      return NextResponse.json({ error: 'معرف الحساب (instanceId) مطلوب' }, { status: 400 });
    }

    // Verify ownership
    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: instanceId, userId: user.userId }
    });

    if (!instance) {
      return NextResponse.json({ error: 'الحساب غير موجود أو لا تملكه' }, { status: 404 });
    }

    let config;
    if (disconnect) {
      config = await prisma.googleSheetsConfig.upsert({
        where: { instanceId },
        update: {
          accessToken: null,
          refreshToken: null,
          expiryDate: null,
          spreadsheetId: null,
          spreadsheetName: null,
          sheetName: null,
          columnMapping: null,
          enabled: false
        },
        create: {
          instanceId,
          enabled: false
        }
      });
    } else {
      const updateData: any = {
        enabled: enabled !== undefined ? enabled : false
      };

      if (spreadsheetId !== undefined) updateData.spreadsheetId = spreadsheetId;
      if (spreadsheetName !== undefined) updateData.spreadsheetName = spreadsheetName;
      if (sheetName !== undefined) updateData.sheetName = sheetName;
      if (columnMapping !== undefined) updateData.columnMapping = typeof columnMapping === 'string' ? columnMapping : JSON.stringify(columnMapping);

      config = await prisma.googleSheetsConfig.upsert({
        where: { instanceId },
        update: updateData,
        create: {
          instanceId,
          enabled: enabled !== undefined ? enabled : false,
          spreadsheetId: spreadsheetId || undefined,
          spreadsheetName: spreadsheetName || undefined,
          sheetName: sheetName || undefined,
          columnMapping: columnMapping ? (typeof columnMapping === 'string' ? columnMapping : JSON.stringify(columnMapping)) : undefined
        }
      });
    }

    return NextResponse.json({ 
      config: {
        id: config.id,
        instanceId: config.instanceId,
        spreadsheetId: config.spreadsheetId,
        spreadsheetName: config.spreadsheetName,
        sheetName: config.sheetName,
        columnMapping: config.columnMapping,
        enabled: config.enabled,
        isConnected: !!(config.accessToken && config.refreshToken)
      }, 
      message: 'تم حفظ إعدادات جوجل شيتس بنجاح' 
    });
  } catch (error: any) {
    console.error('Save Google Sheets config error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء حفظ الإعدادات', details: error.message },
      { status: 500 }
    );
  }
}
