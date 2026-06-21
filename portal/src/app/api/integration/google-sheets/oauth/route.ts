import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getOAuthCredentials } from '../helper';
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

    const { clientId, redirectUri } = getOAuthCredentials();

    if (!clientId) {
      return NextResponse.json({ 
        error: 'إعدادات OAuth غير مكتملة على السيرفر. يرجى تهيئة GOOGLE_CLIENT_ID و GOOGLE_CLIENT_SECRET في ملف .env للسيرفر أولاً.' 
      }, { status: 400 });
    }

    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/drive.readonly'
    ];

    const state = instanceId;
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: state
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({ url: googleAuthUrl });
  } catch (error: any) {
    console.error('OAuth redirect URL generation error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ ما أثناء توليد رابط تسجيل الدخول لجوجل', details: error.message },
      { status: 500 }
    );
  }
}
