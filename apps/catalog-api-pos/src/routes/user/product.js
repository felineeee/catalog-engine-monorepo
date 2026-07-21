import { Type } from '@catalog-engine/server';
import { replicaDb } from '../../db/index.js';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { redis, redlock } from '../../cache/index.js';
import { productIndex } from '../../search/index.js';
export async function productRoutes(app) {
    // PRODUCT
    app.get('/products', {
        schema: {
            querystring: Type.Object({
                // Pagination
                cursor: Type.Optional(Type.String({ description: 'Last product ID seen' })),
                limit: Type.Optional(Type.Number({ default: 20, minimum: 1, maximum: 100 })),
                // Filters
                is_active: Type.Optional(Type.Boolean()),
                category_id: Type.Optional(Type.String({ format: 'uuid' })),
                min_price: Type.Optional(Type.Number()),
                max_price: Type.Optional(Type.Number()),
            }),
        },
        config: {
            rateLimit: { max: 20, timeWindow: '1 minute' },
        },
    }, async (request, reply) => {
        const { limit = 20, cursor, is_active, category_id, min_price, max_price, } = request.query;
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
            jsonArrayFrom(eb
                .selectFrom('product_barcodes as b')
                .select(['b.barcode'])
                .whereRef('b.product_id', '=', 'p.id')).as('barcodes'),
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
        const nextCursor = products.length === limit ? products[products.length - 1].id : null;
        return {
            data: products,
            pagination: {
                next_cursor: nextCursor,
                has_more: products.length === limit,
            },
        };
    });
    app.get('/products/:id', {
        schema: {
            params: Type.Object({
                id: Type.String({ description: 'The Product ID', format: 'uuid' }),
            }),
        },
    }, async (request, reply) => {
        const { id } = request.params;
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
                    jsonArrayFrom(eb
                        .selectFrom('product_barcodes as b')
                        .select(['b.barcode'])
                        .whereRef('b.product_id', '=', 'p.id')).as('barcodes'),
                ])
                    .where('p.id', '=', id)
                    .executeTakeFirst();
                // 4. Handle Not Found (Cache the negative result to prevent DDoS via fake IDs)
                if (!product) {
                    await redis.set(cacheKey, JSON.stringify({ error: 'Not found' }), 'EX', 10);
                    return reply.status(404).send({ error: 'Product not found' });
                }
                // 5. Cache the Success
                const productJson = JSON.stringify(product);
                await redis.set(cacheKey, productJson, 'EX', 60);
                reply.header('X-Cache', 'MISS');
                return reply.type('application/json').send(productJson);
            });
        }
        catch (err) {
            app.log.error(err, `Failed to acquire lock for ${id}`);
            return reply
                .status(503)
                .send({ error: 'Service temporarily overloaded' });
        }
    });
    app.get('/search', {
        schema: {
            querystring: Type.Object({
                q: Type.String({
                    description: 'The search query string',
                    default: '',
                }),
                category: Type.Optional(Type.String({ description: 'Filter by category name' })),
                limit: Type.Optional(Type.Number({ default: 20, maximum: 50 })),
            }),
        },
        config: {
            rateLimit: { max: 20, timeWindow: '1 minute' },
        },
    }, async (request, reply) => {
        // 1. Tell TypeScript exactly what TypeBox just validated
        const { q, limit, category } = request.query;
        // 2. Build the Meilisearch filter array dynamically
        const filter = [];
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
    });
}
