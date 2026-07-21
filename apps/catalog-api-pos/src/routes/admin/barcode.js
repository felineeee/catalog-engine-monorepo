import { Type } from '@catalog-engine/server';
import { db } from '../../db/index.js';
export async function barcodeAdminRoutes(app) {
    // POST: Add a new barcode to a product
    app.post('/products/:id/barcodes', {
        schema: {
            params: Type.Object({
                id: Type.String({ format: 'uuid' }),
            }),
            body: Type.Object({
                barcode: Type.String(),
                // Optional: Add variant_id here if you implement variants!
            }),
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const { barcode } = request.body;
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
        }
        catch (error) {
            // Handle Postgres unique constraint violation if barcode already exists
            if (error.code === '23505') {
                return reply
                    .status(409)
                    .send({ error: 'Barcode is already assigned to a product.' });
            }
            throw error;
        }
    });
    // DELETE: Remove a barcode from a product
    app.delete('/products/:id/barcodes/:barcode', {
        schema: {
            params: Type.Object({
                id: Type.String({ format: 'uuid' }),
                barcode: Type.String(),
            }),
        },
    }, async (request, reply) => {
        const { id, barcode } = request.params;
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
    });
}
