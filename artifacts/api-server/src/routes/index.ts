import { Router, type IRouter } from "express";
import healthRouter from "./health";
import purchaseEntryRouter from "./purchase-entry";
import reportsRouter from "./reports";
import suppliersRouter from "./suppliers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(purchaseEntryRouter);
router.use(reportsRouter);
router.use(suppliersRouter);

export default router;
