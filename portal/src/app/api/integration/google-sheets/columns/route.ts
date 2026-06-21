import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getValidToken } from '../helper';
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
    const spreadsheetId = searchParams.get('spreadsheetId');
    const sheetName = searchParams.get('sheetName');

    if (!instanceId || !spreadsheetId || !sheetName) {
      return NextResponse.json({ error: 'المعاملات المطلوبة (instanceId, spreadsheetId, sheetName) ناقصة' }, { status: 400 });
    }

    const instance = await prisma.whatsAppInstance.findFirst({
      where: { id: instanceId, userId: user.userId }
    });

    if (!instance) {
      return NextResponse.json({ error: 'الحساب غير موجود أو لا تملكه' }, { status: 404 });
    }

    let token: string;
    try {
      token = await getValidToken(instanceId);
    } catch (tokenErr: any) {
      return NextResponse.json({ error: tokenErr.message, isOAuthError: true }, { status: 400 });
    }

    const range = encodeURIComponent(`${sheetName}!A1:Z2`);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Google Sheets API values error response:', data);
      return NextResponse.json({ error: data.error?.message || 'فشل قراءة أعمدة جدول البيانات' }, { status: response.status });
    }

    const values = data.values || [];
    if (values.length === 0) {
      return NextResponse.json({ columns: [], sample: {} });
    }

    const columns = values[0] || [];
    const sampleRow = values[1] || [];
    
    const sample: Record<string, string> = {};
    columns.forEach((col: string, idx: number) => {
      if (col) {
        sample[col] = sampleRow[idx] || '';
      }
    });

    return NextResponse.json({ columns, sample });
  } catch (error: any) {
    console.error('Fetch columns error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء قراءة الأعمدة', details: error.message },
      { status: 500 }
    );
  }
}
