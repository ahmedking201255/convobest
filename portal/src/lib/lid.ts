import { createPool, type Pool } from 'mariadb';
import { mysqlPoolConfigFromUrl } from './mysql-config';

let authPool: Pool | null = null;

function getAuthPool(): Pool {
  if (!authPool) {
    const portalDatabaseUrl = process.env.DATABASE_URL || '';
    const explicitAuthUrl = process.env.EVOGO_AUTH_DATABASE_URL || process.env.AUTH_DATABASE_URL;
    const authUrl =
      explicitAuthUrl ||
      (portalDatabaseUrl.includes('saas_portal')
        ? portalDatabaseUrl.replace('saas_portal', 'evogo_auth')
        : portalDatabaseUrl);

    authPool = createPool(mysqlPoolConfigFromUrl(authUrl));
  }

  return authPool;
}

export async function resolveLidToPn(lidOrJid: string): Promise<string | null> {
  if (!lidOrJid) return null;
  const lid = normalizeJidUser(lidOrJid);
  if (!lid) return null;

  const pool = getAuthPool();
  try {
    const rows = await pool.query<{ pn: string }[]>(
      'SELECT pn FROM whatsmeow_lid_map WHERE lid = ? LIMIT 1',
      [lid]
    );
    return rows[0]?.pn || null;
  } catch (err) {
    console.error(`[LID Resolve Error] Failed to resolve LID ${lid}:`, err);
  }

  return null;
}

export function normalizeJidUser(jidOrNumber: string): string {
  if (!jidOrNumber) return '';
  return jidOrNumber.split('@')[0].split(':')[0].replace(/\D/g, '');
}

export async function upsertLidPnMapping(lidOrJid: string, pnOrJid: string): Promise<boolean> {
  const lid = normalizeJidUser(lidOrJid);
  const pn = normalizeJidUser(pnOrJid);

  if (!lid || !pn || lid === pn) return false;

  const pool = getAuthPool();
  try {
    await pool.query(
      `INSERT INTO whatsmeow_lid_map (lid, pn)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE pn = VALUES(pn), updated_at = CURRENT_TIMESTAMP`,
      [lid, pn]
    );
    return true;
  } catch (err) {
    console.error(`[LID Map Error] Failed to save LID ${lid} -> PN ${pn}:`, err);
  }

  return false;
}
