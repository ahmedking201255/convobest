import { createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from './db';

const MAX_ATTEMPTS = 5;

function hashOtp(phone: string, code: string) {
  const secret = process.env.JWT_SECRET || process.env.GLOBAL_API_KEY;
  if (!secret) throw new Error('OTP hashing secret is not configured');

  return createHash('sha256')
    .update(`${phone}:${code}:${secret}`)
    .digest('hex');
}

export const otpStore = {
  async set(phone: string, code: string, durationMinutes = 10) {
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    const codeHash = hashOtp(phone, code);

    await prisma.registrationOtp.upsert({
      where: { phone },
      create: { phone, codeHash, expiresAt },
      update: { codeHash, expiresAt, attempts: 0 },
    });
  },

  async verify(phone: string, code: string): Promise<boolean> {
    const record = await prisma.registrationOtp.findUnique({ where: { phone } });
    if (!record) return false;

    if (record.expiresAt <= new Date() || record.attempts >= MAX_ATTEMPTS) {
      await prisma.registrationOtp.delete({ where: { phone } }).catch(() => undefined);
      return false;
    }

    const expected = Buffer.from(record.codeHash, 'hex');
    const received = Buffer.from(hashOtp(phone, code), 'hex');
    const matches = expected.length === received.length && timingSafeEqual(expected, received);

    if (!matches) {
      await prisma.registrationOtp.update({
        where: { phone },
        data: { attempts: { increment: 1 } },
      });
    }

    return matches;
  },

  async delete(phone: string) {
    await prisma.registrationOtp.delete({ where: { phone } }).catch(() => undefined);
  },
};
