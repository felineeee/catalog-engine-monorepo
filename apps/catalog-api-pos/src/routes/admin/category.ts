import { FastifyInstance } from 'fastify';
import { Type } from '@catalog-engine/server';
import { db, replicaDb } from '../../db/index.js';

export async function categoryAdminRoutes(app: FastifyInstance) {
  // POST: Create a new category
  app.post(
    '/categories',
    {
      schema: {
        tags: ['Categories (Admin)'],
        summary: 'Create a new category',
        description:
          'Creates a new product category. Supports infinite nesting by providing an optional parent_id.',
        body: Type.Object({
          name: Type.String({
            description: 'The display name of the category (e.g., "Beverages")',
          }),
          parent_id: Type.Optional(
            Type.String({
              format: 'uuid',
              description:
                'The UUID of the parent category, if this is a sub-category',
            }),
          ),
        }),
        response: {
          201: Type.Object({
            data: Type.Object({
              id: Type.String({ format: 'uuid' }),
              name: Type.String(),
              parent_id: Type.Union([
                Type.String({ format: 'uuid' }),
                Type.Null(),
              ]),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, parent_id } = request.body as any;

      const newCategory = await db
        .insertInto('categories')
        .values({
          name,
          parent_id: parent_id ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return reply.status(201).send({ data: newCategory });
    },
  );

  // PATCH: Rename or Move a category
  app.patch(
    '/categories/:id',
    {
      schema: {
        tags: ['Categories (Admin)'],
        summary: 'Update a category',
        description:
          'Rename a category or move it to a different part of the hierarchy by changing its parent_id.',
        params: Type.Object({
          id: Type.String({
            format: 'uuid',
            description: 'The UUID of the category to update',
          }),
        }),
        body: Type.Object({
          name: Type.Optional(
            Type.String({ description: 'New name for the category' }),
          ),
          parent_id: Type.Optional(
            Type.Union([Type.String({ format: 'uuid' }), Type.Null()], {
              description:
                'New parent UUID, or null to make it a top-level category',
            }),
          ),
        }),
        response: {
          200: Type.Object({
            data: Type.Object({
              id: Type.String({ format: 'uuid' }),
              name: Type.String(),
              parent_id: Type.Union([
                Type.String({ format: 'uuid' }),
                Type.Null(),
              ]),
            }),
          }),
          400: Type.Object({
            error: Type.String({
              example: 'Category cannot be its own parent',
            }),
          }),
          404: Type.Object({
            error: Type.String({ example: 'Category not found' }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;

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
    },
  );

  // DELETE: Remove a category
  app.delete(
    '/categories/:id',
    {
      schema: {
        tags: ['Categories (Admin)'],
        summary: 'Delete a category',
        description:
          'Removes a category. Will return a 409 Conflict if there are still products attached to this category.',
        params: Type.Object({
          id: Type.String({
            format: 'uuid',
            description: 'The UUID of the category to delete',
          }),
        }),
        response: {
          204: Type.Null({
            description: 'Category successfully deleted (No Content returned)',
          }),
          404: Type.Object({
            error: Type.String({ example: 'Category not found' }),
          }),
          409: Type.Object({
            error: Type.String({
              example:
                'Cannot delete category because it still contains products.',
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

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
    },
  );
}
