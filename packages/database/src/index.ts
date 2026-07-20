import { Pool, PoolConfig } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';

export function createDatabaseClient<DatabaseType>(
  connectionString: string,
  overrides?: PoolConfig,
) {
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ...overrides,
  });

  return new Kysely<DatabaseType>({
    dialect: new PostgresDialect({ pool }),
  });
}
