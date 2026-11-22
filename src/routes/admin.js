import { Router } from "express";
import { collections } from "../db.js";
import { checkNotBlocked, verifyRole } from "../middleware/auth-checks.js";
import { verifyToken } from "../middleware/verify-token.js";

const router = Router();

router.use(verifyToken, checkNotBlocked, verifyRole("admin"));

router.get("/stats", async (req, res) => {
  const [
    totalUsers,
    totalVendors,
    totalCustomers,
    totalServices,
    pendingServices,
    totalTransactions,
  ] = await Promise.all([
    collections.users.countDocuments(),
    collections.users.countDocuments({ role: "vendor" }),
    collections.users.countDocuments({ role: "customer" }),
    collections.services.countDocuments(),
    collections.services.countDocuments({ status: "pending" }),
    collections.transactions.countDocuments(),
  ]);

  res.json({
    totalUsers,
    totalVendors,
    totalCustomers,
    totalServices,
    pendingServices,
    totalTransactions,
  });
});

export default router;
