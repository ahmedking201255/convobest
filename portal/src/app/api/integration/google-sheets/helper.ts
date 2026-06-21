import { prisma } from '@/lib/db';

export function getOAuthCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const portalBaseUrl = (
    process.env.NEXT_PUBLIC_PORTAL_URL ||
    process.env.PORTAL_URL ||
    'https://convobest.com'
  ).replace(/\/$/, '');
  const redirectUri = `${portalBaseUrl}/api/integration/google-sheets/oauth/callback`;
  return { clientId, clientSecret, redirectUri };
}

export async function getValidToken(instanceId: string): Promise<string> {
  const config = await prisma.googleSheetsConfig.findUnique({
    where: { instanceId }
  });

  if (!config || !config.accessToken || !config.refreshToken) {
    throw new Error('لم يتم ربط حساب جوجل بنجاح أو انتهت صلاحية الجلسة');
  }

  const isExpired = !config.expiryDate || new Date(config.expiryDate).getTime() < Date.now() + 5 * 60 * 1000;
  if (!isExpired) {
    return config.accessToken as string;
  }

  const { clientId, clientSecret } = getOAuthCredentials();
  
  if (!clientId || !clientSecret) {
    throw new Error('لم يتم تهيئة Google Client ID أو Client Secret في ملف .env للسيرفر');
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || 'فشل تحديث رمز الوصول الخاص بجوجل');
    }

    const newExpiry = new Date(Date.now() + data.expires_in * 1000);
    
    const updated = await prisma.googleSheetsConfig.update({
      where: { instanceId },
      data: {
        accessToken: data.access_token,
        expiryDate: newExpiry,
      },
    });

    return updated.accessToken as string;
  } catch (err: any) {
    console.error('Error refreshing Google token:', err);
    throw new Error(`فشل تحديث التوكن: ${err.message}`);
  }
}
