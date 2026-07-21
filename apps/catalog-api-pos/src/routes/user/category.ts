import { FastifyInstance } from 'fastify';
import { Type } from '@catalog-engine/server';
import { productIndex } from '../../search/index.js';
import { replicaDb, db } from '../../db/index.js';
export async function categoryRoutes(app: FastifyInstance) {
  // UI
  app.get(
    '/facets',
    {
      schema: {
        tags: ['Category (UI)'],
        summary: 'Get category facets',
        description:
          'Returns a tally of all categories and how many products belong to them. Used to build dynamic sidebar filters.',
        querystring: Type.Object({
          q: Type.Optional(
            Type.String({
              description: 'Contextual search query to scope the facets',
            }),
          ),
        }),
        response: {
          200: Type.Object({
            data: Type.Array(
              Type.Object({
                name: Type.String({
                  description: 'The category name (e.g., "Beverages")',
                }),
                count: Type.Number({
                  description: 'Number of products in this category',
                }),
              }),
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const { q } = request.query as { q?: string };

      const searchResults = await productIndex.search(q || '', {
        facets: ['category_name'],
        limit: 0,
      });

      const categoryFacets =
        searchResults.facetDistribution?.category_name || {};

      const formattedCategories = Object.entries(categoryFacets).map(
        ([name, count]) => ({
          name,
          count,
        }),
      );

      return {
        data: formattedCategories,
      };
    },
  );
}
