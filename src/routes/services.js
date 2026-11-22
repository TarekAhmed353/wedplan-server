import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../db.js";
import { getPlanSummary } from "../lib/plan.js";
import {
  checkNotBlocked,
  requireRoleChosen,
  verifyRole,
} from "../middleware/auth-checks.js";
import { verifyToken } from "../middleware/verify-token.js";
import { validateService } from "../validators/service.js";

const router = Router();

router.post(
  "/",
  verifyToken,
  checkNotBlocked,
  requireRoleChosen,
  verifyRole("vendor"),
  async (req, res) => {
    const { errors, value } = validateService(req.body ?? {});

    if (Object.keys(errors).length > 0) {
      return res
        .status(400)
        .json({ message: "Please check the service details", errors });
    }

    const plan = await getPlanSummary(req.user);

    if (!plan.canAddService) {
      return res.status(403).json({
        message:
          "The free plan allows 3 active services. Upgrade to Premium to add more",
        code: "FREE_LIMIT_REACHED",
      });
    }

    const now = new Date();
    const service = {
      ...value,
      vendorId: new ObjectId(req.user.id),
      status: "pending",
      isAvailable: true,
      createdAt: now,
      updatedAt: now,
    };

    const { insertedId } = await collections.services.insertOne(service);

    res.status(201).json({ service: { ...service, _id: insertedId } });
  },
);

export default router;
