import { FastifyInstance } from 'fastify';
import { Type } from '@catalog-engine/server';
import { replicaDb, db } from '../../db/index.js'; // MUST use master db for writes
import { productIndex, ProductSearchDocument } from '../../search/index.js';

export async function productAdminRoutes(app: FastifyInstance) {
  // GET: Fetch all categories (Flat List)
  app.get(
    '/categories',
    {
      schema: {
        tags: ['Categories (Admin)'],
        summary: 'List all categories',
        description:
          'Fetches a flat list of all categories ordered alphabetically. Frontend clients should use the parent_id to construct a nested category tree (e.g., for dropdowns or sidebars).',
        response: {
          200: Type.Object({
            data: Type.Array(
              Type.Object({
                id: Type.String({ format: 'uuid' }),
                name: Type.String(),
                parent_id: Type.Union([
                  Type.String({ format: 'uuid' }),
                  Type.Null(),
                ]),
              }),
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const categories = await replicaDb
        .selectFrom('categories')
        .selectAll()
        .orderBy('name', 'asc')
        .execute();

      return { data: categories };
    },
  );
  // POST: Create Product & Barcodes
  app.post(
    '/products',
    {
      schema: {
        tags: ['Product (Admin)'],
        summary: 'Create a new product',
        description:
          'Creates a product and links initial barcodes in a single database transaction.',
        body: Type.Object({
          sku: Type.String({ description: 'Unique stock keeping unit' }),
          name: Type.String({ description: 'Product display name' }),
          price: Type.String({
            description: 'Price in string format (e.g. "12.99")',
          }),
          description: Type.Optional(
            Type.String({ description: 'Detailed product description' }),
          ),
          category_id: Type.Optional(
            Type.String({
              format: 'uuid',
              description: 'Associated category UUID',
            }),
          ),
          image_url: Type.Optional(
            Type.String({ description: 'Product image URL' }),
          ),
          is_active: Type.Optional(
            Type.Boolean({
              default: true,
              description: 'Whether item is active on POS',
            }),
          ),
          barcodes: Type.Optional(
            Type.Array(Type.String(), {
              description: 'List of barcodes/UPCs to assign',
            }),
          ),
        }),
        response: {
          201: Type.Object({
            data: Type.Object({
              id: Type.String({ format: 'uuid' }),
              sku: Type.String(),
              name: Type.String(),
              price: Type.String(),
              description: Type.Union([Type.String(), Type.Null()]),
              category_id: Type.Union([Type.String(), Type.Null()]),
              image_url: Type.Union([Type.String(), Type.Null()]),
              is_active: Type.Boolean(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as any;

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
          const barcodeInserts = body.barcodes.map((barcode: string) => ({
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
    },
  );

  // PATCH: Update Product & Sync Barcodes
  app.patch(
    '/products/:id',
    {
      schema: {
        tags: ['Product (Admin)'],
        summary: 'Update an existing product',
        description:
          'Partially updates product fields and syncs barcodes (wipes existing barcodes and replaces them if a new barcodes array is passed).',
        params: Type.Object({
          id: Type.String({
            format: 'uuid',
            description: 'Product UUID to update',
          }),
        }),
        body: Type.Object({
          sku: Type.Optional(Type.String()),
          name: Type.Optional(Type.String()),
          price: Type.Optional(Type.String()),
          description: Type.Optional(Type.String()),
          category_id: Type.Optional(Type.String({ format: 'uuid' })),
          image_url: Type.Optional(Type.String()),
          is_active: Type.Optional(Type.Boolean()),
          barcodes: Type.Optional(
            Type.Array(Type.String(), {
              description: 'Replacement array of barcodes',
            }),
          ),
        }),
        response: {
          200: Type.Object({
            message: Type.String({ example: 'Product updated successfully' }),
          }),
          400: Type.Object({
            error: Type.String({ example: 'No data provided to update' }),
          }),
          404: Type.Object({
            error: Type.String({ example: 'Product not found' }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { barcodes, ...productFields } = request.body as any;

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
            const barcodeInserts = barcodes.map((b: string) => ({
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
    },
  );

  // DELETE: Soft or Hard Delete Product
  app.delete(
    '/products/:id',
    {
      schema: {
        tags: ['Product (Admin)'],
        summary: 'Delete a product',
        description:
          'Deletes a product by ID. Performs a soft-delete by default (sets deleted_at). Pass permanent=true as a query param to permanently delete from the database.',
        params: Type.Object({
          id: Type.String({
            format: 'uuid',
            description: 'The product UUID',
          }),
        }),
        querystring: Type.Object({
          permanent: Type.Optional(
            Type.Boolean({
              default: false,
              description: 'Set to true for hard removal from database',
            }),
          ),
        }),
        response: {
          200: Type.Object({
            message: Type.String(),
            type: Type.String({ example: 'soft_delete' }),
          }),
          404: Type.Object({
            error: Type.String({ example: 'Product not found' }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { permanent } = request.query as { permanent?: boolean };

      if (permanent) {
        // --- HARD DELETE (Transaction) ---
        const deleted = await db.transaction().execute(async (trx) => {
          // 1. Delete associated barcodes first
          await trx
            .deleteFrom('product_barcodes')
            .where('product_id', '=', id)
            .execute();

          // 2. Delete the actual product
          const result = await trx
            .deleteFrom('products')
            .where('id', '=', id)
            .executeTakeFirst();

          return Number(result.numDeletedRows) > 0;
        });

        if (!deleted) {
          return reply.status(404).send({ error: 'Product not found' });
        }

        return reply.send({
          message: 'Product permanently purged from database',
          type: 'hard_delete',
        });
      } else {
        // --- SOFT DELETE ---
        const result = await db
          .updateTable('products')
          .set({ deleted_at: new Date() })
          .where('id', '=', id)
          .where('deleted_at', 'is', null) // Avoid updating already deleted items
          .executeTakeFirst();

        if (Number(result.numUpdatedRows) === 0) {
          return reply
            .status(404)
            .send({ error: 'Product not found or already deleted' });
        }

        return reply.send({
          message: 'Product marked as deleted',
          type: 'soft_delete',
        });
      }
    },
  );
  // ADMIN
  app.post(
    '/system/search/sync',
    {
      schema: {
        tags: ['System & Search'],
        summary: 'Trigger Meilisearch sync',
        description:
          'Triggers a full catalog sync from PostgreSQL to Meilisearch. Returns a task UID that can be polled for completion.',
        response: {
          202: Type.Object({
            message: Type.String({
              example: 'Search sync queued successfully',
            }),
            meilisearch_task_uid: Type.Number({ example: 42 }),
            documents_queued: Type.Number({ example: 1250 }),
          }),
        },
      },
      // TODO: Add your authentication preHandler here later
      // to ensure ONLY SuperAdmins can trigger this!
    },
    async (request, reply) => {
      app.log.info('Manual search sync triggered by admin');

      // 1. Fetch the absolute latest state of the catalog
      const products: ProductSearchDocument[] = await replicaDb
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
    },
  );
}
