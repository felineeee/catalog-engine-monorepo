import { FastifyInstance } from 'fastify';
import { Type } from '@catalog-engine/server';
import { db, replicaDb } from '../../db/index.js';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { redis, redlock } from '../../cache/index.js';
import { productIndex } from '../../search/index.js';

export async function productRoutes(app: FastifyInstance) {
  // PRODUCT
  app.get(
    '/products',
    {
      schema: {
        tags: ['Product (Cashier)'],
        summary: 'List all products',
        description:
          'Fetch a paginated list of products. Supports cursor-based pagination and dynamic filtering.',

        querystring: Type.Object({
          limit: Type.Optional(
            Type.Number({ default: 20, minimum: 1, maximum: 100 }),
          ),
          cursor: Type.Optional(
            Type.String({ description: 'Last product ID seen' }),
          ),
          is_active: Type.Optional(Type.Boolean()),
          category_id: Type.Optional(Type.String({ format: 'uuid' })),
          min_price: Type.Optional(Type.Number()),
          max_price: Type.Optional(Type.Number()),
        }),

        response: {
          200: Type.Object({
            data: Type.Array(
              Type.Object({
                id: Type.String({ format: 'uuid' }),
                sku: Type.String(),
                name: Type.String(),
                price: Type.String(),
                is_active: Type.Boolean(),
                category_name: Type.Union([Type.String(), Type.Null()]),
              }),
            ),
            pagination: Type.Object({
              next_cursor: Type.Union([Type.String(), Type.Null()]),
              has_more: Type.Boolean(),
            }),
          }),
        },
      },

      config: {
        rateLimit: { max: 20, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      const {
        limit = 20,
        cursor,
        is_active,
        category_id,
        min_price,
        max_price,
      } = request.query as any;

      // 1. Base query with ALL the fields (including your nested barcodes)
      let query = replicaDb
        .selectFrom('products as p')
        .leftJoin('categories as c', 'c.id', 'p.category_id')
        .select([
          'p.id',
          'p.sku',
          'p.name',
          'p.price',
          'p.description',
          'p.image_url',
          'p.is_active',
          'c.name as category_name',
        ])
        .select((eb) => [
          jsonArrayFrom(
            eb
              .selectFrom('product_barcodes as b')
              .select(['b.barcode'])
              .whereRef('b.product_id', '=', 'p.id'),
          ).as('barcodes') as any,
        ]);

      // 2. Conditionally apply filters ONLY if they exist in the query string
      if (typeof is_active === 'boolean') {
        query = query.where('p.is_active', '=', is_active);
      }
      if (category_id) {
        query = query.where('p.category_id', '=', category_id);
      }
      if (min_price !== undefined) {
        query = query.where('p.price', '>=', min_price.toString());
      }
      if (max_price !== undefined) {
        query = query.where('p.price', '<=', max_price.toString());
      }

      // 3. Cursor Pagination
      if (cursor) {
        query = query.where('p.id', '>', cursor);
      }

      // 4. Order, limit, and execute
      const products = await query
        .orderBy('p.id', 'asc')
        .limit(limit)
        .execute();

      const nextCursor =
        products.length === limit ? products[products.length - 1].id : null;

      return {
        data: products,
        pagination: {
          next_cursor: nextCursor,
          has_more: products.length === limit,
        },
      };
    },
  );
  app.get(
    '/products/:id',
    {
      schema: {
        tags: ['Product (Cashier)'],
        summary: 'Get a single product',
        description:
          'Fetch complete details for a specific product by its UUID. Cached via Redis.',
        params: Type.Object({
          id: Type.String({
            format: 'uuid',
            description: 'The UUID of the product',
          }),
        }),
        response: {
          200: Type.Object({
            data: Type.Object({
              id: Type.String({ format: 'uuid' }),
              sku: Type.String(),
              name: Type.String(),
              price: Type.String(),
              description: Type.Union([Type.String(), Type.Null()]),
              category_name: Type.Union([Type.String(), Type.Null()]),
              barcodes: Type.Array(Type.Object({ barcode: Type.String() })),
            }),
          }),
          404: Type.Object({
            error: Type.String({ default: 'Product not found' }),
          }),
          503: Type.Object({
            error: Type.String({ defailt: 'Service temporarily overloaded' }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const cacheKey = `product:${id}`;

      // 1. Fast Path: Check Cache First
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        reply.header('X-Cache', 'HIT');
        return reply.type('application/json').send(cachedData);
      }

      const lockKey = `lock:product:${id}`;

      try {
        // 2. Cache Stampede Prevention (Redlock)
        return await redlock.acquire([lockKey], 2000, async () => {
          const doubleCheck = await redis.get(cacheKey);
          if (doubleCheck) {
            reply.header('X-Cache', 'HIT-AFTER-WAIT');
            return reply.type('application/json').send(doubleCheck);
          }

          // 3. Database Query (Updated for new schema)
          const product = await replicaDb
            .selectFrom('products as p')
            .leftJoin('categories as c', 'c.id', 'p.category_id')
            .select([
              'p.id',
              'p.sku',
              'p.name',
              'p.price',
              'p.description',
              'p.image_url',
              'p.is_active',
              'c.name as category_name',
            ])
            .select((eb) => [
              jsonArrayFrom(
                eb
                  .selectFrom('product_barcodes as b')
                  .select(['b.barcode'])
                  .whereRef('b.product_id', '=', 'p.id'),
              ).as('barcodes') as any,
            ])
            .where('p.id', '=', id)
            .executeTakeFirst();

          // 4. Handle Not Found (Cache the negative result to prevent DDoS via fake IDs)
          if (!product) {
            await redis.set(
              cacheKey,
              JSON.stringify({ error: 'Not found' }),
              'EX',
              10, // Short expiry for 404s
            );
            return reply.status(404).send({ error: 'Product not found' });
          }

          // 5. Cache the Success
          const productJson = JSON.stringify(product);
          await redis.set(cacheKey, productJson, 'EX', 60);

          reply.header('X-Cache', 'MISS');
          return reply.type('application/json').send(productJson);
        });
      } catch (err) {
        app.log.error(err as Error, `Failed to acquire lock for ${id}`);
        return reply
          .status(503)
          .send({ error: 'Service temporarily overloaded' });
      }
    },
  );

  app.get(
    '/search',
    {
      schema: {
        tags: ['Product (Cashier)'],
        summary: 'Search catalog',
        description:
          'Ultra-fast typo-tolerant search powered by Meilisearch. Designed for the POS cashier interface.',
        querystring: Type.Object({
          q: Type.Optional(
            Type.String({
              description: 'The search query string (e.g., "apple juice")',
            }),
          ),
          category: Type.Optional(
            Type.String({
              description: 'Filter results by exact category name',
            }),
          ),
          limit: Type.Optional(
            Type.Number({
              default: 20,
              maximum: 50,
              description: 'Max results to return',
            }),
          ),
        }),
        response: {
          200: Type.Object({
            data: Type.Array(
              Type.Any({ description: 'Array of Meilisearch document hits' }),
            ),
            processingTimeMs: Type.Number({
              description: 'How fast the search engine executed the query',
            }),
            estimatedTotalHits: Type.Number({
              description: 'Approximate number of total matching documents',
            }),
          }),
        },
      },
      config: {
        rateLimit: { max: 20, timeWindow: '1 minute' },
      },
    },
    async (request, reply) => {
      // 1. Tell TypeScript exactly what TypeBox just validated
      const { q, limit, category } = request.query as {
        q: string;
        limit: number;
        category?: string;
      };

      // 2. Build the Meilisearch filter array dynamically
      const filter: string[] = [];
      if (category) {
        filter.push(`category_name = "${category}"`);
      }

      // 3. Execute the search
      const searchResults = await productIndex.search(q, {
        limit: limit,
        filter: filter,
        attributesToHighlight: ['name'],
      });

      return {
        data: searchResults.hits,
        processingTimeMs: searchResults.processingTimeMs,
        estimatedTotalHits: searchResults.estimatedTotalHits,
      };
    },
  );
}
