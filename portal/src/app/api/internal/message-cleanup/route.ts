import { timingSafeEqual } from 'crypto';
import mariadb from 'mariadb';
import { NextResponse } from 'next/server';
import { mysqlPoolConfigFromUrl } from '@/lib/mysql-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RETENTION_DAYS = 5;
const LOCK_NAME = 'convobest_message_cleanup';

function isAuthorized(request: Request): boolean {
  const expected = process.env.MESSAGE_CLEANUP_SECRET || process.env.JWT_SECRET;
  const provided = request.headers.get('x-cleanup-secret') || '';
  if (!expected || expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = mysqlPoolConfigFromUrl(process.env.DATABASE_URL);
  const connection = await mariadb.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectTimeout: config.connectTimeout,
  });

  let lockAcquired = false;

  try {
    const lockRows = await connection.query<{ acquired: number }[]>(
      'SELECT GET_LOCK(?, 0) AS acquired',
      [LOCK_NAME],
    );
    lockAcquired = lockRows[0]?.acquired === 1;

    if (!lockAcquired) {
      return NextResponse.json({ cleaned: false, reason: 'already-running' });
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS MaintenanceState (
        maintenanceKey VARCHAR(191) NOT NULL PRIMARY KEY,
        lastRunAt DATETIME(3) NOT NULL,
        updatedAt DATETIME(3) NOT NULL
      ) ENGINE=InnoDB
    `);

    const stateRows = await connection.query<{ isDue: number; nextRunAt: string }[]>(
      `SELECT
         UTC_TIMESTAMP(3) >= DATE_ADD(lastRunAt, INTERVAL ${RETENTION_DAYS} DAY) AS isDue,
         DATE_FORMAT(
           DATE_ADD(lastRunAt, INTERVAL ${RETENTION_DAYS} DAY),
           '%Y-%m-%dT%H:%i:%s.000Z'
         ) AS nextRunAt
       FROM MaintenanceState
       WHERE maintenanceKey = ?
       LIMIT 1`,
      [LOCK_NAME],
    );
    const state = stateRows[0];

    if (state && state.isDue !== 1) {
      return NextResponse.json({
        cleaned: false,
        reason: 'not-due',
        nextRunAt: state.nextRunAt,
      });
    }

    const inboxCountRows = await connection.query<{ count: bigint }[]>('SELECT COUNT(*) AS count FROM InboxMessage');
    const logCountRows = await connection.query<{ count: bigint }[]>('SELECT COUNT(*) AS count FROM MessageLog');
    const inboxDeleted = Number(inboxCountRows[0]?.count || 0);
    const logsDeleted = Number(logCountRows[0]?.count || 0);

    await connection.query('TRUNCATE TABLE InboxMessage');
    await connection.query('TRUNCATE TABLE MessageLog');
    await connection.query(
      `INSERT INTO MaintenanceState (maintenanceKey, lastRunAt, updatedAt)
       VALUES (?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
       ON DUPLICATE KEY UPDATE lastRunAt = VALUES(lastRunAt), updatedAt = VALUES(updatedAt)`,
      [LOCK_NAME],
    );

    console.log(`[Message Cleanup] Deleted ${inboxDeleted} inbox messages and ${logsDeleted} message logs.`);
    return NextResponse.json({ cleaned: true, inboxDeleted, logsDeleted, retentionDays: RETENTION_DAYS });
  } catch (error: any) {
    console.error('[Message Cleanup] Failed:', error);
    return NextResponse.json({ error: 'Cleanup failed', details: error.message }, { status: 500 });
  } finally {
    if (lockAcquired) {
      try {
        await connection.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
      } catch {
        // Closing the connection releases the lock as a fallback.
      }
    }
    await connection.end();
  }
}
