import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const purchaseEntriesTable = pgTable("purchase_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierId: text("supplier_id").notNull(),
  supplierName: text("supplier_name").notNull(),
  itemName: text("item_name").notNull(),
  price: text("price").notNull(),
  orderNumber: text("order_number"),
  recipient: text("recipient").notNull(),
  gmailThreadId: text("gmail_thread_id").notNull().unique(),
  status: text("status").notNull().default("Sent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPurchaseEntrySchema = createInsertSchema(purchaseEntriesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertPurchaseEntry = z.infer<typeof insertPurchaseEntrySchema>;
export type PurchaseEntry = typeof purchaseEntriesTable.$inferSelect;
