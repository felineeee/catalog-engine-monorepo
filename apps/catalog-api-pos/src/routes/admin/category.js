import { Type } from '@catalog-engine/server';
import { db } from '../../db/index.js';
export async function categoryAdminRoutes(app) {
    // POST: Create a new category
    app.post('/categories', {
        schema: {
            body: Type.Object({
                name: Type.String(),
                parent_id: Type.Optional(Type.String({ format: 'uuid' })),
            }),
        },
    }, async (request, reply) => {
        const { name, parent_id } = request.body;
        const newCategory = await db
            .insertInto('categories')
            .values({
            name,
            parent_id: parent_id ?? null,
        })
            .returningAll()
            .executeTakeFirstOrThrow();
        return reply.status(201).send({ data: newCategory });
    });
    // PATCH: Rename or Move a category
    app.patch('/categories/:id', {
        schema: {
            params: Type.Object({
                id: Type.String({ format: 'uuid' }),
            }),
            body: Type.Object({
                name: Type.Optional(Type.String()),
                parent_id: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
            }),
        },
    }, async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        if (Object.keys(body).length === 0) {
            return reply.status(400).send({ error: 'No fields provided' });
        }
        // Prevent a category from being its own parent
        if (body.parent_id === id) {
            return reply
                .status(400)
                .send({ error: 'Category cannot be its own parent' });
        }
        const updatedCategory = await db
            .updateTable('categories')
            .set(body)
            .where('id', '=', id)
            .returningAll()
            .executeTakeFirst();
        if (!updatedCategory) {
            return reply.status(404).send({ error: 'Category not found' });
        }
        return { data: updatedCategory };
    });
    // DELETE: Remove a category
    app.delete('/categories/:id', {
        schema: {
            params: Type.Object({
                id: Type.String({ format: 'uuid' }),
            }),
        },
    }, async (request, reply) => {
        const { id } = request.params;
        // Optional Safety Check: Ensure no products are using this category before deleting.
        // Alternatively, rely on PostgreSQL foreign key constraints to block the deletion.
        const productsUsingCategory = await db
            .selectFrom('products')
            .select('id')
            .where('category_id', '=', id)
            .limit(1)
            .executeTakeFirst();
        if (productsUsingCategory) {
            return reply.status(409).send({
                error: 'Cannot delete category because it still contains products.',
            });
        }
        const result = await db
            .deleteFrom('categories')
            .where('id', '=', id)
            .executeTakeFirst();
        if (Number(result.numDeletedRows) === 0) {
            return reply.status(404).send({ error: 'Category not found' });
        }
        return reply.status(204).send();
    });
}
