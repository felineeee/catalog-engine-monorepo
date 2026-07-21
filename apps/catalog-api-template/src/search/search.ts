import { createMeilisearchClient } from '@catalog-engine/search';
import { ProductSearchDocument } from './types';

// The app provides its specific generic type <ProductSearchDocument>
// and connects to the 'products' index.
export const productIndex = createMeilisearchClient<ProductSearchDocument>(
  process.env.MEILISEARCH_HOST!,
  process.env.MEILISEARCH_KEY!,
  'products',
);
