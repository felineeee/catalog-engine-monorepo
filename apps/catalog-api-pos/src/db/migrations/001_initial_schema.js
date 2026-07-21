import { sql } from 'kysely';
export async function up(db) {
    // 1. Categories
    await db.schema
        .createTable('categories')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql `gen_random_uuid()`))
        .addColumn('name', 'varchar(255)', (col) => col.notNull())
        .addColumn('parent_id', 'uuid', (col) => col.references('categories.id'))
        .execute();
    // 2. Products
    await db.schema
        .createTable('products')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql `gen_random_uuid()`))
        .addColumn('sku', 'varchar(255)', (col) => col.notNull().unique())
        .addColumn('name', 'varchar(255)', (col) => col.notNull())
        .addColumn('description', 'text')
        .addColumn('image_url', 'text')
        .addColumn('price', 'numeric(10, 2)', (col) => col.notNull())
        .addColumn('is_active', 'boolean', (col) => col.defaultTo(true).notNull())
        .addColumn('category_id', 'uuid', (col) => col.references('categories.id'))
        .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql `now()`).notNull())
        .addColumn('updated_at', 'timestamp', (col) => col.defaultTo(sql `now()`).notNull())
        .addColumn('deleted_at', 'timestamp')
        .execute();
    // 3. Product Barcodes
    await db.schema
        .createTable('product_barcodes')
        .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql `gen_random_uuid()`))
        .addColumn('product_id', 'uuid', (col) => col.references('products.id').onDelete('cascade').notNull())
        .addColumn('barcode', 'varchar(255)', (col) => col.notNull().unique())
        .execute();
    // 4. Indexes for faster lookups on Foreign Keys
    await db.schema
        .createIndex('idx_categories_parent_id')
        .on('categories')
        .column('parent_id')
        .execute();
    await db.schema
        .createIndex('idx_products_category_id')
        .on('products')
        .column('category_id')
        .execute();
    await db.schema
        .createIndex('idx_product_barcodes_product_id')
        .on('product_barcodes')
        .column('product_id')
        .execute();
}
export async function down(db) {
    await db.schema.dropTable('product_barcodes').execute();
    await db.schema.dropTable('products').execute();
    await db.schema.dropTable('categories').execute();
}
