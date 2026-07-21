import { Meilisearch } from 'meilisearch';
import * as dotenv from 'dotenv';

export function createMeilisearchClient<T extends Record<string, any>>(
  meilisearchHost: string,
  meilisearchKey: string,
  indexUid: string,
) {
  const searchClient = new Meilisearch({
    host:
      meilisearchHost ||
      process.env.MEILISEARCH_HOST ||
      'http://localhost:7700',
    apiKey:
      meilisearchKey || process.env.MEILISEARCH_KEY || 'supersecret_meili',
  });

  return searchClient.index<T>(indexUid);
}
