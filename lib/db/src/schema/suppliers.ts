import { createInsertSchema } from "drizzle-zod";
import { pgTable, text } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const suppliersTable = pgTable("suppliers", {
  supplierId: text("supplier_id").primaryKey(),
  supplierName: text("supplier_name").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  country: text("country").notNull(),
  paymentTerms: text("payment_terms").notNull(),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable);
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
