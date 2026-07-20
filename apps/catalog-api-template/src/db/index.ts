import { createDatabaseClient } from '@catalog-engine/database';
import { DB } from './types';
import * as dotenv from 'dotenv';

dotenv.config();

export const db = createDatabaseClient<DB>(process.env.DATABASE_URL!);
export const replicaDb = createDatabaseClient<DB>(
  process.env.DATABASE_URL_REPLICA!,
  { max: 40 },
);
