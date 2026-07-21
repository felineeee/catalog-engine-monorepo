import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Numeric = ColumnType<string, number | string, number | string>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface Categories {
  id: Generated<string>;
  name: string;
  parent_id: string | null;
}

export interface ProductBarcodes {
  barcode: string;
  id: Generated<string>;
  product_id: string;
}

export interface Products {
  category_id: string | null;
  created_at: Generated<Timestamp>;
  deleted_at: Timestamp | null;
  description: string | null;
  id: Generated<string>;
  image_url: string | null;
  is_active: Generated<boolean>;
  name: string;
  price: Numeric;
  sku: string;
  updated_at: Generated<Timestamp>;
}

export interface DB {
  categories: Categories;
  product_barcodes: ProductBarcodes;
  products: Products;
}
