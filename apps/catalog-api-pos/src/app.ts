import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import ratelimit from '@fastify/rate-limit';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { sql } from 'kysely';
import { db } from '../src/db/index.js';

import { redis } from '../src/cache/index.js';

import { productRoutes } from './routes/user/product.js';
import { categoryRoutes } from './routes/user/category.js';
import { categoryAdminRoutes } from './routes/admin/category.js';
import { barcodeAdminRoutes } from './routes/admin/barcode.js';
import { productAdminRoutes } from './routes/admin/product.js';

export function buildApp() {
  const app = Fastify({
    logger: { transport: { target: 'pino-pretty' } },
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.register(ratelimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis: redis,
    keyGenerator: (request) => {
      return (request.headers['x-forwarded-for'] as string) || request.ip;
    },
    errorResponseBuilder: (request, context) => {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Catalog access limit exceeded. Please try again in ${context.after}.`,
      };
    },
  });
  // 1. Register the Swagger Generator FIRST
  app.register(swagger, {
    openapi: {
      info: {
        title: 'POS Catalog API',
        description:
          'Blazing fast catalog engine using PostgreSQL, Redis, and Meilisearch.',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local development server',
        },
      ],
    },
  });

  // 2. Register the Swagger UI SECOND
  app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
  });

  // 3. Register your routes
  // TODO Define role later
  app.register(productRoutes, { prefix: '/api' });
  app.register(categoryRoutes, { prefix: '/api' });

  app.register(categoryAdminRoutes, { prefix: '/api/admin' });
  app.register(barcodeAdminRoutes, { prefix: '/api/admin' });
  app.register(productAdminRoutes, { prefix: '/api/admin' });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/health/db', async (request, reply) => {
    try {
      const result = await sql`SELECT NOW()`.execute(db as any);
      return {
        database: 'Connected',
        time: result.rows[0],
        pool_status: 'Healthy',
      };
    } catch (error) {
      app.log.error(error);
      return reply
        .status(500)
        .send({ database: 'Disconnected', error: 'Connection failed' });
    }
  });

  return app;
}
