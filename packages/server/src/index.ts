import Fastify from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import rateLimit from '@fastify/rate-limit';
import type { Redis } from 'ioredis';

interface ServerOptions {
  redisClient?: Redis;
  globalRateLimit?: number;
}

export function createServer(options: ServerOptions = {}) {
  const app = Fastify({
    logger: { transport: { target: 'pino-pretty' } },
  }).withTypeProvider<TypeBoxTypeProvider>();

  if (options.redisClient) {
    app.register(rateLimit, {
      global: true,
      max: options.globalRateLimit || 100,
      timeWindow: '1 minute',
      redis: options.redisClient,
    });
  }

  return app;
}

export { Type } from '@sinclair/typebox';
