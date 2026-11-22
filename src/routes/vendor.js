import { Router } from "express";
import { getPlanSummary } from "../lib/plan.js";
import {
  checkNotBlocked,
  requireRoleChosen,
  verifyRole,
} from "../middleware/auth-checks.js";
import { verifyToken } from "../middleware/verify-token.js";

const router = Router();

router.use(verifyToken, checkNotBlocked, requireRoleChosen, verifyRole("vendor"));

router.get("/plan", async (req, res) => {
  res.json(await getPlanSummary(req.user));
});

export default router;
