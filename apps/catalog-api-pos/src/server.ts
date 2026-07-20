import { createServer } from '@catalog-engine/server';
import { redis } from './cache';
import { catalogRoutes } from './routes/catalog';
import * as dotenv from 'dotenv';

dotenv.config();

const start = async () => {
  const app = createServer({
    redisClient: redis,
    globalRateLimit: 100,
  });

  app.register(catalogRoutes);

  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log(`Catalog API listening at http://localhost:3000`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
