import { Router, type IRouter } from "express";
// ✅ Add .js extensions to satisfy Node.js ESM resolution
import healthRouter from "./health.js";
import optimizeRouter from "./optimize.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(optimizeRouter);

export default router;
