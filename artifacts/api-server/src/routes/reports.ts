import { asc, desc, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { GetSupplierSpendReportResponse } from "@workspace/api-zod";
import { db, purchaseEntriesTable, suppliersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/reports/supplier-spend", async (_req, res): Promise<void> => {
  const totalSpend = sql<string>`SUM(CAST(${purchaseEntriesTable.price} AS numeric))`.mapWith(String);
  const rows = await db
    .select({
      supplier: suppliersTable.supplierName,
      totalSpend,
    })
    .from(purchaseEntriesTable)
    .leftJoin(
      suppliersTable,
      sql`${purchaseEntriesTable.supplierId} = ${suppliersTable.supplierId}`,
    )
    .groupBy(suppliersTable.supplierName)
    .orderBy(desc(totalSpend), asc(suppliersTable.supplierName));

  res.json(GetSupplierSpendReportResponse.parse(rows));
});

export default router;
