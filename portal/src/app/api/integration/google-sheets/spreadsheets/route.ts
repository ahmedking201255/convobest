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

    if (!instanceId) {
      return NextResponse.json({ error: 'معرف الحساب (instanceId) مطلوب' }, { status: 400 });
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

    const response = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&fields=files(id,name)&pageSize=100&orderBy=name",
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Google Drive API error response:', data);
      return NextResponse.json({ error: data.error?.message || 'فشل جلب الملفات من جوجل درايف' }, { status: response.status });
    }

    return NextResponse.json({ spreadsheets: data.files || [] });
  } catch (error: any) {
    console.error('Fetch spreadsheets error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء تحميل ملفات جداول جوجل', details: error.message },
      { status: 500 }
    );
  }
}
