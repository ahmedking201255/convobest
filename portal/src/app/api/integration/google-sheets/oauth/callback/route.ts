import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOAuthCredentials } from '../../helper';
import { userCanUseGoogleSheets } from '@/lib/subscription-access';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('Google OAuth callback error parameter:', error);
      return NextResponse.redirect(new URL(`/dashboard/google-sheets?error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL(`/dashboard/google-sheets?error=missing_code_or_state`, request.url));
    }

    const instanceId = state;

    const instance = await prisma.whatsAppInstance.findUnique({
      where: { id: instanceId }
    });

    if (!instance) {
      return NextResponse.redirect(new URL(`/dashboard/google-sheets?error=invalid_instance`, request.url));
    }

    if (!(await userCanUseGoogleSheets(instance.userId))) {
      return NextResponse.redirect(new URL('/dashboard/google-sheets?upgrade=required', request.url));
    }

    const { clientId, clientSecret, redirectUri } = getOAuthCredentials();

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL(`/dashboard/google-sheets?instanceId=${instanceId}&error=server_missing_env`, request.url));
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Google token exchange error details:', tokenData);
      return NextResponse.redirect(new URL(`/dashboard/google-sheets?instanceId=${instanceId}&error=${encodeURIComponent(tokenData.error_description || tokenData.error || 'token_exchange_failed')}`, request.url));
    }

    const { access_token, refresh_token, expires_in } = tokenData;
    const expiryDate = new Date(Date.now() + expires_in * 1000);

    const updateData: any = {
      accessToken: access_token,
      expiryDate,
      enabled: true
    };

    if (refresh_token) {
      updateData.refreshToken = refresh_token;
    }

    await prisma.googleSheetsConfig.upsert({
      where: { instanceId },
      update: updateData,
      create: {
        instanceId,
        accessToken: access_token,
        refreshToken: refresh_token || null,
        expiryDate,
        enabled: true
      }
    });

    return NextResponse.redirect(new URL(`/dashboard/google-sheets?instanceId=${instanceId}&oauth=success`, request.url));
  } catch (err: any) {
    console.error('Fatal Google OAuth callback handler error:', err);
    return NextResponse.redirect(new URL(`/dashboard/google-sheets?error=${encodeURIComponent(err.message || 'unknown_callback_error')}`, request.url));
  }
}
