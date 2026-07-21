import { Type } from '@catalog-engine/server';
import { productIndex } from '../../search/index.js';
import { replicaDb } from '../../db/index.js';
export async function categoryRoutes(app) {
    // UI
    app.get('/facets', {
        schema: {
            querystring: Type.Object({
                q: Type.Optional(Type.String({ description: 'Contextual search query' })),
            }),
        },
    }, async (request, reply) => {
        const { q } = request.query;
        const searchResults = await productIndex.search(q || '', {
            facets: ['category_name'],
            limit: 0,
        });
        const categoryFacets = searchResults.facetDistribution?.category_name || {};
        const formattedCategories = Object.entries(categoryFacets).map(([name, count]) => ({
            name,
            count,
        }));
        return {
            data: formattedCategories,
        };
    });
    // GET: Fetch all categories (Flat List)
    app.get('/categories', async (request, reply) => {
        const categories = await replicaDb
            .selectFrom('categories')
            .selectAll()
            .orderBy('name', 'asc')
            .execute();
        return { data: categories };
    });
}
