import { FastifyInstance } from 'fastify';
import { Type } from '@catalog-engine/server';
import { replicaDb } from '../db';

export async function catalogRoutes(app: FastifyInstance) {
  app.get(
    '/catalog',
    {
      schema: {
        querystring: Type.Object({
          limit: Type.Optional(Type.Number({ default: 20, maximum: 50 })),
        }),
      },
    },
    async (request, reply) => {
      const { limit } = request.query;

      const products = await replicaDb
        .selectFrom('products')
        .selectAll()
        .limit(limit!)
        .execute();

      return { data: products };
    },
  );
}
