import { Router, type IRouter } from "express";
import healthRouter from "./health";
import employeesRouter from "./employees";
import spotsRouter from "./spots";
import checkinsRouter from "./checkins";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(employeesRouter);
router.use(spotsRouter);
router.use(checkinsRouter);
router.use(dashboardRouter);

export default router;
