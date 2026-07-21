import { db } from '../../../catalog-api-pos/src/db/index.js';
import { faker } from '@faker-js/faker';
const TOTAL_CATEGORIES = 20;
const TOTAL_PRODUCTS = 50_000;
const BATCH_SIZE = 2_500;
async function seed() {
    console.log('Starting database seed...');
    // 1. Seed Categories
    const categoryIds = [];
    for (let i = 0; i < TOTAL_CATEGORIES; i++) {
        const res = await db
            .insertInto('categories')
            .values({
            name: faker.commerce.department() + ' ' + faker.string.uuid().slice(0, 5),
        })
            .returning('id')
            .executeTakeFirstOrThrow();
        categoryIds.push(res.id);
    }
    console.log(`Inserted ${TOTAL_CATEGORIES} categories.`);
    // 2. Seed Products
    const productIds = [];
    for (let i = 0; i < TOTAL_PRODUCTS; i += BATCH_SIZE) {
        const batch = Array.from({
            length: Math.min(BATCH_SIZE, TOTAL_PRODUCTS - i),
        }).map((_, idx) => ({
            sku: `SKU-${faker.string.alphanumeric(6).toUpperCase()}-${i + idx}`,
            name: faker.commerce.productName(),
            description: faker.commerce.productDescription(),
            image_url: faker.image.url(),
            price: faker.commerce.price({ min: 5, max: 2000, dec: 2 }),
            is_active: faker.datatype.boolean({ probability: 0.9 }),
            category_id: faker.helpers.arrayElement(categoryIds),
        }));
        const inserted = await db
            .insertInto('products')
            .values(batch)
            .returning('id')
            .execute();
        productIds.push(...inserted.map((p) => p.id));
        console.log(`Inserted ${productIds.length} / ${TOTAL_PRODUCTS} products...`);
    }
    // 3. Seed Product Barcodes
    let barcodesInserted = 0;
    let barcodeBatch = [];
    const BARCODE_BATCH_SIZE = 2500;
    for (const productId of productIds) {
        const numBarcodes = faker.number.int({ min: 1, max: 3 });
        for (let k = 0; k < numBarcodes; k++) {
            barcodeBatch.push({
                product_id: productId,
                barcode: `${faker.string.numeric(12)}-${productId.slice(0, 4)}-${k}`,
            });
        }
        if (barcodeBatch.length >= BARCODE_BATCH_SIZE) {
            await db.insertInto('product_barcodes').values(barcodeBatch).execute();
            barcodesInserted += barcodeBatch.length;
            console.log(`Inserted ${barcodesInserted} barcodes...`);
            barcodeBatch = [];
        }
    }
    // Flush remaining barcodes
    if (barcodeBatch.length > 0) {
        await db.insertInto('product_barcodes').values(barcodeBatch).execute();
        barcodesInserted += barcodeBatch.length;
        console.log(`Inserted ${barcodesInserted} barcodes total!`);
    }
    console.log('Seeding complete!');
    await db.destroy();
}
seed().catch(console.error);
