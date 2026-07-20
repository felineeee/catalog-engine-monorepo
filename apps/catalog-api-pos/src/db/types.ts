import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export type Json = ColumnType<JsonValue, string, string>;

export type JsonArray = JsonValue[];

export type JsonObject = {
  [K in string]?: JsonValue;
};

export type JsonPrimitive = boolean | number | string | null;

export type JsonValue = JsonArray | JsonObject | JsonPrimitive;

export type Numeric = ColumnType<string, number | string, number | string>;

export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export interface AuditLog {
  action: string;
  createdAt: Generated<Timestamp>;
  id: Generated<string>;
  newValue: Json | null;
  oldValue: Json | null;
  recordId: string;
  tableName: string;
  userId: string;
}

export interface Branch {
  address: string | null;
  createdAt: Generated<Timestamp>;
  id: Generated<string>;
  name: string;
}

export interface Inventory {
  branchId: string;
  id: Generated<string>;
  lastUpdated: Generated<Timestamp>;
  lowStockThreshold: Generated<number>;
  productId: string;
  quantity: number;
}

export interface Order {
  branchId: string;
  cashierId: string;
  createdAt: Generated<Timestamp>;
  id: Generated<string>;
  status: Generated<"COMPLETED" | "FULLY_REFUNDED" | "PARTIALLY_REFUNDED">;
  totalAmount: Numeric;
}

export interface OrderItem {
  id: Generated<string>;
  orderId: string;
  priceAtCheckout: Numeric;
  productId: string;
  quantity: number;
  refundedQty: Generated<number>;
}

export interface Product {
  createdAt: Generated<Timestamp>;
  id: Generated<string>;
  isActive: Generated<boolean>;
  name: string;
  price: Numeric;
  sku: string;
  updatedAt: Timestamp;
}

export interface Refund {
  amount: Numeric;
  createdAt: Generated<Timestamp>;
  id: Generated<string>;
  managerId: string;
  orderId: string;
  reason: string;
}

export interface StockTransfer {
  approvedById: string | null;
  createdAt: Generated<Timestamp>;
  fromBranchId: string;
  id: Generated<string>;
  initiatedById: string;
  productId: string;
  quantity: number;
  status: Generated<"PENDING" | "RECEIVED" | "REJECTED" | "SHIPPED">;
  toBranchId: string;
  updatedAt: Timestamp;
}

export interface User {
  branchId: string | null;
  createdAt: Generated<Timestamp>;
  email: string;
  id: Generated<string>;
  isActive: Generated<boolean>;
  name: string;
  passwordHash: string;
  role: "BRANCH_MANAGER" | "CASHIER" | "SUPER_ADMIN";
}

export interface DB {
  AuditLog: AuditLog;
  Branch: Branch;
  Inventory: Inventory;
  Order: Order;
  OrderItem: OrderItem;
  Product: Product;
  Refund: Refund;
  StockTransfer: StockTransfer;
  User: User;
}
