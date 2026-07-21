export interface ProductSearchDocument {
  id: string; // Meilisearch requires a primary key, usually 'id'
  name: string;
  description: string;
  price: number;
  category: string;
}
