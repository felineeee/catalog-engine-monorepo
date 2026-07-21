import { FastifyInstance } from 'fastify';
import { Type } from '@catalog-engine/server';
import { db } from '../../db/index.js';

export async function barcodeAdminRoutes(app: FastifyInstance) {
  // POST: Add a new barcode to a product
  app.post(
    '/products/:id/barcodes',
    {
      schema: {
        tags: ['Barcodes (Admin)'],
        summary: 'Add a barcode to a product',
        description:
          'Assigns a new, additional barcode to an existing product. Returns a 409 Conflict if the barcode is already registered to another item in the database.',
        params: Type.Object({
          id: Type.String({
            format: 'uuid',
            description: 'The UUID of the parent product',
          }),
        }),
        body: Type.Object({
          barcode: Type.String({
            description: 'The new barcode/UPC string (e.g., "012345678912")',
          }),
          // Uncomment this if you implement the variants table later!
          // variant_id: Type.Optional(Type.String({ format: 'uuid', description: 'Optional ID if this barcode belongs to a specific size/color variant' })),
        }),
        response: {
          201: Type.Object({
            data: Type.Object({
              id: Type.String({ format: 'uuid' }),
              product_id: Type.String({ format: 'uuid' }),
              variant_id: Type.Union([
                Type.String({ format: 'uuid' }),
                Type.Null(),
              ]),
              barcode: Type.String(),
            }),
          }),
          409: Type.Object({
            error: Type.String({
              example: 'Barcode is already assigned to a product.',
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { barcode } = request.body as { barcode: string };

      try {
        const newBarcode = await db
          .insertInto('product_barcodes')
          .values({
            product_id: id,
            barcode: barcode,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return reply.status(201).send({ data: newBarcode });
      } catch (error: any) {
        // Handle Postgres unique constraint violation if barcode already exists
        if (error.code === '23505') {
          return reply
            .status(409)
            .send({ error: 'Barcode is already assigned to a product.' });
        }
        throw error;
      }
    },
  );

  // DELETE: Remove a barcode from a product
  app.delete(
    '/products/:id/barcodes/:barcode',
    {
      schema: {
        tags: ['Barcodes (Admin)'],
        summary: 'Remove a barcode from a product',
        description:
          'Deletes a specific barcode assignment from a product. Often used if a cashier mis-scans a manufacturer barcode during product creation.',
        params: Type.Object({
          id: Type.String({
            format: 'uuid',
            description: 'The UUID of the product',
          }),
          barcode: Type.String({
            description: 'The exact barcode string to remove',
          }),
        }),
        response: {
          204: Type.Null({
            description: 'Barcode successfully deleted (No Content returned)',
          }),
          404: Type.Object({
            error: Type.String({
              example: 'Barcode not found on this product.',
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id, barcode } = request.params as { id: string; barcode: string };

      const result = await db
        .deleteFrom('product_barcodes')
        .where('product_id', '=', id)
        .where('barcode', '=', barcode)
        .executeTakeFirst();

      if (Number(result.numDeletedRows) === 0) {
        return reply
          .status(404)
          .send({ error: 'Barcode not found on this product.' });
      }

      return reply.status(204).send();
    },
  );
}
