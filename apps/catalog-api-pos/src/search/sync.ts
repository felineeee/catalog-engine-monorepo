// src/search/sync.ts
import { replicaDb } from '../db/index.js';
import { productIndex, ProductSearchDocument } from './index.js';

async function syncToMeili() {
  console.log('Fetching products from PostgreSQL...');

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

  console.log(`Pushing ${products.length} products to Meilisearch...`);

  const task = await productIndex.addDocuments(products);

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

  console.log('Meilisearch sync command issued! Task ID:', task.taskUid);

  await replicaDb.destroy();
}

syncToMeili().catch(console.error);
