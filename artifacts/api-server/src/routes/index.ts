import { Router, type IRouter } from "express";
import healthRouter from "./health";
import employeesRouter from "./employees";
import spotsRouter from "./spots";
import checkinsRouter from "./checkins";
import dashboardRouter from "./dashboard";
import importRouter from "./import";

const router: IRouter = Router();

router.use(healthRouter);
router.use(employeesRouter);
router.use(spotsRouter);
router.use(checkinsRouter);
router.use(dashboardRouter);
router.use(importRouter);

export default router;
