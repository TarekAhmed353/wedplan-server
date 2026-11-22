import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../db.js";
import {
  BOOKING_STATUSES,
  serviceSummaryLookup,
  toStatusCounts,
  userSummaryLookup,
} from "../lib/booking-views.js";
import {
  checkNotBlocked,
  requireRoleChosen,
  verifyRole,
} from "../middleware/auth-checks.js";
import { verifyToken } from "../middleware/verify-token.js";

const router = Router();

router.use(verifyToken, checkNotBlocked, requireRoleChosen, verifyRole("customer"));

router.get("/stats", async (req, res) => {
  const customerId = new ObjectId(req.user.id);
  const rows = await collections.bookings
    .aggregate([{ $match: { customerId } }, { $group: { _id: "$status", count: { $sum: 1 } } }])
    .toArray();
  const counts = toStatusCounts(rows);

  res.json({
    totalRequests: counts.all,
    pending: counts.pending,
    accepted: counts.accepted,
    rejected: counts.rejected,
    cancelled: counts.cancelled,
  });
});

router.get("/bookings", async (req, res) => {
  const customerId = new ObjectId(req.user.id);
  const status = BOOKING_STATUSES.includes(req.query.status) ? req.query.status : null;

  const [bookings, statusRows] = await Promise.all([
    collections.bookings
      .aggregate([
        { $match: status ? { customerId, status } : { customerId } },
        { $sort: { createdAt: -1 } },
        { $limit: 200 },
        ...serviceSummaryLookup,
        ...userSummaryLookup("vendorId", "vendor", true),
      ])
      .toArray(),
    collections.bookings
      .aggregate([{ $match: { customerId } }, { $group: { _id: "$status", count: { $sum: 1 } } }])
      .toArray(),
  ]);

  res.json({ bookings, counts: toStatusCounts(statusRows) });
});

export default router;
