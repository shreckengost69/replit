import { Router, type IRouter } from "express";
import healthRouter from "./health";
import suppliersRouter from "./suppliers";

const router: IRouter = Router();

router.use(healthRouter);
router.use(suppliersRouter);

export default router;
