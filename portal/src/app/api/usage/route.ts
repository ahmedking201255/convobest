import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getMonthlyMessageUsage } from '@/lib/message-quota';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'غير مصرح بالدخول' }, { status: 401 });
  }

  const usage = await getMonthlyMessageUsage(user.userId);
  return NextResponse.json(
    { usage },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
