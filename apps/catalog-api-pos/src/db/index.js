import { createDatabaseClient } from '@catalog-engine/database';
import * as dotenv from 'dotenv';
dotenv.config();
export const db = createDatabaseClient(process.env.DATABASE_URL);
export const replicaDb = createDatabaseClient(process.env.DATABASE_URL_REPLICA, { max: 40 });
