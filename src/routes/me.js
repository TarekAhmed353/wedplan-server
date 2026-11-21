import { Router } from "express";
import { verifyToken } from "../middleware/verify-token.js";

const router = Router();

router.get("/", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

export default router;
