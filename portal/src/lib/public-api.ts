import { prisma } from '@/lib/db';

export function getApiKey(request: Request) {
  const directKey = request.headers.get('apikey')?.trim();
  if (directKey) return directKey;

  const authorization = request.headers.get('authorization') || '';
  return authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : '';
}

export async function getApiInstance(request: Request) {
  const apiKey = getApiKey(request);
  if (!apiKey) return null;

  return prisma.whatsAppInstance.findFirst({
    where: { token: apiKey },
    select: {
      id: true,
      userId: true,
      token: true,
      status: true,
    }
  });
}

export function sanitizeApiNumber(value: unknown) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}
