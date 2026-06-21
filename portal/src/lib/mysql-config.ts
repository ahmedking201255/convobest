function readPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function mysqlPoolConfigFromUrl(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. Use mysql://USER:PASSWORD@HOST:3306/DATABASE.');
  }

  const url = new URL(databaseUrl);
  if (url.protocol !== 'mysql:') {
    throw new Error('DATABASE_URL must start with mysql:// after switching Prisma to MySQL.');
  }

  const database = url.pathname.replace(/^\//, '');
  if (!database) {
    throw new Error('DATABASE_URL must include a database name.');
  }

  return {
    host: url.hostname,
    port: url.port ? Number.parseInt(url.port, 10) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(database),
    connectionLimit: readPositiveInt(url.searchParams.get('connection_limit') || url.searchParams.get('connectionLimit'), 10),
    acquireTimeout: readPositiveInt(url.searchParams.get('pool_timeout') || url.searchParams.get('acquireTimeout'), 10000),
    connectTimeout: readPositiveInt(url.searchParams.get('connect_timeout') || url.searchParams.get('connectTimeout'), 5000),
    idleTimeout: readPositiveInt(url.searchParams.get('idle_timeout') || url.searchParams.get('idleTimeout'), 30),
  };
}
