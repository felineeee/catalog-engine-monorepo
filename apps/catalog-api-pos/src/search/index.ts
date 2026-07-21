import * as dotenv from 'dotenv';
import { createMeilisearchClient } from '@catalog-engine/search';

dotenv.config();

export interface ProductSearchDocument {
  id: string;
  sku: string;
  name: string;
  price: string;
  description: string | null;
  category_name: string | null;
  image_url: string | null;
  is_active: boolean;
}
export const productIndex = createMeilisearchClient<ProductSearchDocument>(
  process.env.MEILISEARCH_HOST || 'http://localhost:7700',
  process.env.MEILISEARCH_KEY || 'supersecret_meili',
  'products', // This is the name of the "bucket" in Meilisearch
);
