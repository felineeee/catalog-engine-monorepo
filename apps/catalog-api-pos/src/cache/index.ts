import { createCacheClient } from '@catalog-engine/cache';
import * as dotenv from 'dotenv';

dotenv.config();

export const { redis, redlock } = createCacheClient(
  process.env.REDIS_URL || 'redis://localhost:6379',
);
