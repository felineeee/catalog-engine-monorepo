# Catalog Engine
## Preliminary

## Tech Stack

## Key Feature

## ER Diagram


```mermaid
erDiagram

    %% Catalog Domain (Root)
    POS_ORDER ||--|{ ORDER_LINE_ITEM : "contains"
    CATEGORY ||--o{ PRODUCT : "groups"
    PRODUCT ||--o{ ORDER_LINE_ITEM : "sold as"
    PRODUCT ||--o{ INVENTORY_ITEM : "tracked as"
    BRANCH ||--o{ INVENTORY_ITEM : "holds"
    BRANCH ||--o{ POS_ORDER : "processes"

    CATEGORY {
        uuid id PK
        string name
        string slug
        uuid parent_id FK "Nullable for top-level"
    }

    PRODUCT {
        uuid id PK
        string name
        text description
        decimal price
        uuid category_id FK
        datetime created_at
        datetime updated_at
    }

    BRANCH {
        uuid id PK
        string name
        string type "WAREHOUSE or POS_STORE"
        string location_address
    }

    INVENTORY_ITEM {
        uuid product_id PK, FK
        uuid branch_id PK, FK
        int stock_count
        string warehouse_location "e.g., Aisle 4, Shelf B"
        datetime last_counted_at
    }

    POS_ORDER {
        uuid id PK
        uuid branch_id FK
        decimal total_amount
        string payment_status
        datetime created_at
    }

    ORDER_LINE_ITEM {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        int quantity
        decimal price_at_sale "Locks in historical price"
    }
```
---

## 1. System Architecture Diagram

The Catalog Engine utilizes a high-performance, resilient, and multi-tiered stack designed for sub-millisecond lookups at the point of sale (POS).

```mermaid
flowchart TD
    Client([Client / Cashier POS]) <-->|HTTP Requests| Fastify[Fastify API Server]
    
    subgraph "Caching & Rate Limiting"
        Fastify <-->|Rate Limit & Product Cache| Redis[(Redis Cache)]
        Fastify -.->|Distributed Locks| Redlock[Redlock Manager]
    end

    subgraph "Database Layer (PostgreSQL & Kysely)"
        Fastify -->|Writes / Transactions| PG_Master[(Postgres Master DB)]
        Fastify -->|Reads / Queries| PG_Replica[(Postgres Replica DB)]
        PG_Master -.->|Streaming Replication| PG_Replica
    end

    subgraph "Search Engine"
        Fastify <-->|Typo-tolerant Search| Meili[(Meilisearch)]
        Fastify -.->|Manual Sync Trigger| Meili
    end
```

### Components Summary
- **Fastify API Server**: Handles routing, validation (TypeBox), and serialization.
- **Redis Cache**: Holds cached product details (`product:<id>`) and handles rate limiting keys.
- **Redlock Manager**: Coordinates distributed locks across Fastify instances to prevent cache stampedes.
- **Postgres Master DB**: The source of truth for all write/administrative mutations.
- **Postgres Replica DB**: Handles all high-volume read lookups to isolate transactional traffic from cashier requests.
- **Meilisearch**: Powers ultra-fast typo-tolerant search specifically optimized for cashier barcode/text entry lookups.

## Endpoints

### Simple Master Data vs. Search Indexing

* **Master Data (Postgres):** CRUD operations for categories, products, and barcodes alter core relational entities in the database. Later specified into separate `read` and `write` database.
* **Search Engine Sync:** High-performance discovery and dynamic filtering are decoupled from standard CRUD via an asynchronous indexing pipeline (Meilisearch).

### Base Catalog

#### Categories

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/categories` | List all product categories (hierarchical) |
| `GET` | `/api/categories/:id` | View specific category details |
| `POST` | `/api/categories` | Create a new category |
| `PATCH` | `/api/categories/:id` | Update a category |
| `DELETE` | `/api/categories/:id` | Delete a category |

#### Products

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/products` | List all base products |
| `GET` | `/api/products/:id` | View a specific product's details and variants |
| `POST` | `/api/products` | Create a new product |
| `PATCH` | `/api/products/:id` | Update base product details |
| `DELETE` | `/api/products/:id` | Delete a product |

#### Barcodes

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/products/:id/barcodes` | List all barcodes attached to a specific product |
| `POST` | `/api/products/:id/barcodes` | Add a new barcode to a product |
| `DELETE` | `/api/products/:id/barcodes/:barcode` | Remove a specific barcode |

#### Search & Discovery

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/facets` | Retrieve available dynamic filters (categories, sizes, colors) for the frontend |
| `GET` | `/api/search` | Execute a search query against the catalog |
| `POST` | `/api/system/search/sync` | Trigger a manual index sync (e.g., pushing Postgres data to Elasticsearch/Typesense/Meilisearch) |
