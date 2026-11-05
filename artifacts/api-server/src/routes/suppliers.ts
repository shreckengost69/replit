import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateSupplierBody,
  CreateSupplierResponse,
  DeleteSupplierParams,
  GetSupplierParams,
  GetSupplierResponse,
  GetSupplierSummaryResponse,
  ListSuppliersQueryParams,
  ListSuppliersResponse,
  UpdateSupplierBody,
  UpdateSupplierParams,
  UpdateSupplierResponse,
} from "@workspace/api-zod";
import { db, suppliersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/suppliers", async (req, res): Promise<void> => {
  const parsed = ListSuppliersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, city, state, paymentTerms, sortBy, sortOrder } = parsed.data;
  const searchCondition = search?.trim()
    ? or(
        ilike(suppliersTable.supplierId, `%${search.trim()}%`),
        ilike(suppliersTable.supplierName, `%${search.trim()}%`),
        ilike(suppliersTable.address, `%${search.trim()}%`),
        ilike(suppliersTable.city, `%${search.trim()}%`),
        ilike(suppliersTable.state, `%${search.trim()}%`),
        ilike(suppliersTable.zipCode, `%${search.trim()}%`),
        ilike(suppliersTable.country, `%${search.trim()}%`),
        ilike(suppliersTable.paymentTerms, `%${search.trim()}%`),
        ilike(suppliersTable.contact, `%${search.trim()}%`),
      )
    : undefined;
  const filters = [
    searchCondition,
    city ? eq(suppliersTable.city, city) : undefined,
    state ? eq(suppliersTable.state, state) : undefined,
    paymentTerms ? eq(suppliersTable.paymentTerms, paymentTerms) : undefined,
  ].filter((filter): filter is SQL => filter !== undefined);
  const sortColumn =
    sortBy === "city"
      ? suppliersTable.city
      : sortBy === "supplierId"
        ? suppliersTable.supplierId
        : suppliersTable.supplierName;

  const suppliers = await db
    .select()
    .from(suppliersTable)
    .where(and(...filters))
    .orderBy(sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn));

  res.json(ListSuppliersResponse.parse(suppliers));
});

router.post("/suppliers", async (req, res): Promise<void> => {
  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select({ supplierId: suppliersTable.supplierId })
    .from(suppliersTable)
    .where(eq(suppliersTable.supplierId, parsed.data.supplierId))
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "A supplier with this ID already exists." });
    return;
  }

  try {
    const [supplier] = await db
      .insert(suppliersTable)
      .values(parsed.data)
      .returning();
    res.status(201).json(CreateSupplierResponse.parse(supplier));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({ error: "A supplier with this ID already exists." });
      return;
    }
    throw error;
  }
});

router.get("/suppliers/summary", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({
      totalSuppliers: sql<number>`count(*)::int`,
      cityCount: sql<number>`count(distinct ${suppliersTable.city})::int`,
      countryCount: sql<number>`count(distinct ${suppliersTable.country})::int`,
    })
    .from(suppliersTable);

  const paymentTerms = await db
    .select({ label: suppliersTable.paymentTerms, count: count() })
    .from(suppliersTable)
    .groupBy(suppliersTable.paymentTerms)
    .orderBy(desc(count()));

  const topCities = await db
    .select({ label: suppliersTable.city, count: count() })
    .from(suppliersTable)
    .groupBy(suppliersTable.city)
    .orderBy(desc(count()), asc(suppliersTable.city))
    .limit(5);

  res.json(
    GetSupplierSummaryResponse.parse({
      totalSuppliers: totals?.totalSuppliers ?? 0,
      cityCount: totals?.cityCount ?? 0,
      countryCount: totals?.countryCount ?? 0,
      paymentTerms,
      topCities,
    }),
  );
});

router.get("/suppliers/:supplierId", async (req, res): Promise<void> => {
  const params = GetSupplierParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [supplier] = await db
    .select()
    .from(suppliersTable)
    .where(eq(suppliersTable.supplierId, params.data.supplierId))
    .limit(1);
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found." });
    return;
  }
  res.json(GetSupplierResponse.parse(supplier));
});

router.patch("/suppliers/:supplierId", async (req, res): Promise<void> => {
  const params = UpdateSupplierParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [supplier] = await db
    .update(suppliersTable)
    .set(parsed.data)
    .where(eq(suppliersTable.supplierId, params.data.supplierId))
    .returning();
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found." });
    return;
  }
  res.json(UpdateSupplierResponse.parse(supplier));
});

router.delete("/suppliers/:supplierId", async (req, res): Promise<void> => {
  const params = DeleteSupplierParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [supplier] = await db
    .delete(suppliersTable)
    .where(eq(suppliersTable.supplierId, params.data.supplierId))
    .returning({ supplierId: suppliersTable.supplierId });
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found." });
    return;
  }
  res.sendStatus(204);
});

export default router;
