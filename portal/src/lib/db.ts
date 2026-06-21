import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';
import { mysqlPoolConfigFromUrl } from './mysql-config';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  adapter: PrismaMariaDb | undefined;
};

const mysqlConfig = mysqlPoolConfigFromUrl(process.env.DATABASE_URL);
const adapter =
  globalForPrisma.adapter ??
  new PrismaMariaDb(mysqlConfig, {
    database: mysqlConfig.database,
  });

globalForPrisma.adapter = adapter;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ['error'],
  });

globalForPrisma.prisma = prisma;
