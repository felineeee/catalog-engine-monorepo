import * as dotenv from 'dotenv';
import { createMeilisearchClient } from '@catalog-engine/search';
dotenv.config();
export const productIndex = createMeilisearchClient(process.env.MEILISEARCH_HOST || 'http://localhost:7700', process.env.MEILISEARCH_KEY || 'supersecret_meili', 'products');
