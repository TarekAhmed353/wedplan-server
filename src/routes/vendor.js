import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../db.js";
import {
  BOOKING_STATUSES,
  serviceSummaryLookup,
  toStatusCounts,
  userSummaryLookup,
} from "../lib/booking-views.js";
import { toObjectId } from "../lib/ids.js";
import { activeServiceFilter, getPlanSummary } from "../lib/plan.js";
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

router.get("/stats", async (req, res) => {
  const vendorId = new ObjectId(req.user.id);

  const [totalServices, activeServices, pendingRequests, acceptedBookings, plan] = await Promise.all([
    collections.services.countDocuments({ vendorId }),
    collections.services.countDocuments(activeServiceFilter(req.user.id)),
    collections.bookings.countDocuments({ vendorId, status: "pending" }),
    collections.bookings.countDocuments({ vendorId, status: "accepted" }),
    getPlanSummary(req.user),
  ]);

  res.json({
    totalServices,
    activeServices,
    pendingRequests,
    acceptedBookings,
    plan: plan.plan,
    limit: plan.limit,
    subscriptionExpiresAt: plan.subscriptionExpiresAt,
  });
});

router.get("/services", async (req, res) => {
  const services = await collections.services
    .find({ vendorId: new ObjectId(req.user.id) })
    .sort({ createdAt: -1 })
    .toArray();

  res.json({ services });
});

router.get("/services/:id", async (req, res) => {
  const id = toObjectId(req.params.id);
  const service = id
    ? await collections.services.findOne({
        _id: id,
        vendorId: new ObjectId(req.user.id),
      })
    : null;

  if (!service) {
    return res.status(404).json({ message: "Service not found" });
  }

  res.json({ service });
});

router.get("/bookings", async (req, res) => {
  const vendorId = new ObjectId(req.user.id);
  const status = BOOKING_STATUSES.includes(req.query.status) ? req.query.status : null;

  const [bookings, statusRows] = await Promise.all([
    collections.bookings
      .aggregate([
        { $match: status ? { vendorId, status } : { vendorId } },
        { $sort: { createdAt: -1 } },
        { $limit: 200 },
        ...serviceSummaryLookup,
        ...userSummaryLookup("customerId", "customer", true),
      ])
      .toArray(),
    collections.bookings
      .aggregate([{ $match: { vendorId } }, { $group: { _id: "$status", count: { $sum: 1 } } }])
      .toArray(),
  ]);

  res.json({ bookings, counts: toStatusCounts(statusRows) });
});

export default router;
