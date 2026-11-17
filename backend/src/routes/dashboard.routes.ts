import { Router } from "express";
import { dashboard } from "../controllers/dashboard.controller.js";
import { authenticate } from "../middlewares/auth.js";

const router = Router();

// always the signed-in user's own view; nothing to parameterise
router.get("/", authenticate, dashboard);

export default router;
