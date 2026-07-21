import { Type } from '@catalog-engine/server';
import { replicaDb, db } from '../../db/index.js'; // MUST use master db for writes
import { productIndex } from '../../search/index.js';
export async function productAdminRoutes(app) {
    // POST: Create Product & Barcodes
    app.post('/products', {
        schema: {
            body: Type.Object({
                sku: Type.String(),
                name: Type.String(),
                price: Type.String(),
                description: Type.Optional(Type.String()),
                category_id: Type.Optional(Type.String({ format: 'uuid' })),
                image_url: Type.Optional(Type.String()),
                is_active: Type.Optional(Type.Boolean({ default: true })),
                // Notice we accept an array of barcodes in the same request!
                barcodes: Type.Optional(Type.Array(Type.String())),
            }),
        },
    }, async (request, reply) => {
        const body = request.body;
        // Start the transaction
        const createdProduct = await db.transaction().execute(async (trx) => {
            // 1. Insert the parent product
            const product = await trx
                .insertInto('products')
                .values({
                sku: body.sku,
                name: body.name,
                price: body.price,
                description: body.description ?? null,
                category_id: body.category_id ?? null,
                image_url: body.image_url ?? null,
                is_active: body.is_active ?? true,
            })
                .returningAll()
                .executeTakeFirstOrThrow();
            // 2. Insert the barcodes (if any were provided)
            if (body.barcodes && body.barcodes.length > 0) {
                const barcodeInserts = body.barcodes.map((barcode) => ({
                    product_id: product.id,
                    barcode: barcode,
                }));
                await trx
                    .insertInto('product_barcodes')
                    .values(barcodeInserts)
                    .execute();
            }
            // Return the final product from the transaction
            return product;
        });
        // TODO: Call your cache invalidation / Meilisearch sync here
        return reply.status(201).send({ data: createdProduct });
    });
    // PATCH: Update Product & Sync Barcodes
    app.patch('/products/:id', {
        schema: {
            params: Type.Object({
                id: Type.String({ format: 'uuid' }),
            }),
            body: Type.Object({
                sku: Type.Optional(Type.String()),
                name: Type.Optional(Type.String()),
                price: Type.Optional(Type.String()),
                description: Type.Optional(Type.String()),
                category_id: Type.Optional(Type.String({ format: 'uuid' })),
                image_url: Type.Optional(Type.String()),
                is_active: Type.Optional(Type.Boolean()),
                barcodes: Type.Optional(Type.Array(Type.String())),
            }),
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const { barcodes, ...productFields } = request.body;
        if (Object.keys(productFields).length === 0 && !barcodes) {
            return reply.status(400).send({ error: 'No data provided to update' });
        }
        await db.transaction().execute(async (trx) => {
            // 1. Update the main product fields (if any were sent)
            if (Object.keys(productFields).length > 0) {
                await trx
                    .updateTable('products')
                    .set(productFields)
                    .where('id', '=', id)
                    .execute();
            }
            // 2. Sync the barcodes
            // In REST API patches, passing an array usually means "replace existing with these"
            if (barcodes) {
                // First, wipe all existing barcodes for this product
                await trx
                    .deleteFrom('product_barcodes')
                    .where('product_id', '=', id)
                    .execute();
                // Then, insert the new ones (if the array isn't empty)
                if (barcodes.length > 0) {
                    const barcodeInserts = barcodes.map((b) => ({
                        product_id: id,
                        barcode: b,
                    }));
                    await trx
                        .insertInto('product_barcodes')
                        .values(barcodeInserts)
                        .execute();
                }
            }
        });
        // Fetch the fully updated product (with barcodes nested) to return to the client
        // (You could reuse a 'getProductById' helper function here if you have one)
        return reply.send({ message: 'Product updated successfully' });
    });
    // ADMIN
    app.post('/system/search/sync', {
    // TODO: Add your authentication preHandler here later
    // to ensure ONLY SuperAdmins can trigger this!
    }, async (request, reply) => {
        app.log.info('Manual search sync triggered by admin');
        // 1. Fetch the absolute latest state of the catalog
        const products = await replicaDb
            .selectFrom('products as p')
            .leftJoin('categories as c', 'c.id', 'p.category_id')
            .select([
            'p.id',
            'p.sku',
            'p.name',
            'p.description',
            'p.price',
            'p.image_url',
            'p.is_active',
            'c.name as category_name',
        ])
            .execute();
        // 2. Queue the documents in Meilisearch
        const task = await productIndex.addDocuments(products);
        // 3. Re-apply the index settings just in case they were lost
        await productIndex.updateSearchableAttributes([
            'name',
            'sku',
            'description',
            'category_name',
        ]);
        await productIndex.updateFilterableAttributes([
            'price',
            'category_name',
            'is_active',
        ]);
        await productIndex.updateSortableAttributes(['price']);
        // 4. Respond instantly while Meilisearch processes in the background
        return reply.status(202).send({
            message: 'Search sync queued successfully',
            meilisearch_task_uid: task.taskUid,
            documents_queued: products.length,
        });
    });
}
