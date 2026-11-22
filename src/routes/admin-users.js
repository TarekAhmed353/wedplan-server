import { Router } from "express";
import { collections, db } from "../db.js";
import { toObjectId } from "../lib/ids.js";
import { isPremium } from "../lib/plan.js";
import { escapeRegex } from "../lib/text.js";

const router = Router();

const ROLES = ["customer", "vendor", "admin"];
const PAGE_SIZE = 10;

const safeUserFields = {
  name: 1,
  email: 1,
  image: 1,
  role: 1,
  roleChosen: 1,
  isBlocked: 1,
  businessName: 1,
  subscriptionPlan: 1,
  subscriptionExpiresAt: 1,
  createdAt: 1,
};

function toAdminUser(user) {
  return {
    ...user,
    isBlocked: user.isBlocked === true,
    isPremium: user.role === "vendor" && isPremium(user),
  };
}

router.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const role = ROLES.includes(req.query.role) ? req.query.role : null;
  const status = ["active", "blocked"].includes(req.query.status) ? req.query.status : null;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

  const baseFilter = {};

  if (search) {
    const pattern = { $regex: escapeRegex(search), $options: "i" };
    baseFilter.$or = [{ name: pattern }, { email: pattern }];
  }

  if (status === "blocked") {
    baseFilter.isBlocked = true;
  } else if (status === "active") {
    baseFilter.isBlocked = { $ne: true };
  }

  const filter = role ? { ...baseFilter, role } : baseFilter;

  const [users, total, roleRows] = await Promise.all([
    collections.users
      .find(filter, { projection: safeUserFields })
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .toArray(),
    collections.users.countDocuments(filter),
    collections.users
      .aggregate([{ $match: baseFilter }, { $group: { _id: "$role", count: { $sum: 1 } } }])
      .toArray(),
  ]);

  const counts = { all: 0, customer: 0, vendor: 0, admin: 0 };
  for (const { _id, count } of roleRows) {
    if (_id in counts) counts[_id] = count;
    counts.all += count;
  }

  res.json({
    users: users.map(toAdminUser),
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts,
  });
});

router.get("/:id", async (req, res) => {
  const id = toObjectId(req.params.id);
  const user = id ? await collections.users.findOne({ _id: id }, { projection: safeUserFields }) : null;

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const [services, bookingsSent, bookingsReceived, payments] = await Promise.all([
    collections.services.countDocuments({ vendorId: id }),
    collections.bookings.countDocuments({ customerId: id }),
    collections.bookings.countDocuments({ vendorId: id }),
    collections.transactions.countDocuments({ vendorId: id, status: "paid" }),
  ]);

  res.json({
    user: toAdminUser(user),
    stats: { services, bookingsSent, bookingsReceived, payments },
  });
});

router.patch("/:id/block", async (req, res) => {
  const { isBlocked } = req.body ?? {};

  if (typeof isBlocked !== "boolean") {
    return res.status(400).json({ message: "isBlocked must be true or false" });
  }

  const id = toObjectId(req.params.id);
  const user = id ? await collections.users.findOne({ _id: id }, { projection: { role: 1 } }) : null;

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (id.toString() === req.user.id) {
    return res.status(400).json({ message: "You cannot block your own account", code: "SELF_BLOCK" });
  }

  if (user.role === "admin") {
    return res.status(403).json({ message: "Admin accounts cannot be blocked", code: "ADMIN_BLOCK" });
  }

  await collections.users.updateOne(
    { _id: id },
    { $set: { isBlocked, updatedAt: new Date() } },
  );

  let endedSessions = 0;

  if (isBlocked) {
    const result = await db.collection("session").deleteMany({ userId: id });
    endedSessions = result.deletedCount;
  }

  res.json({ id, isBlocked, endedSessions });
});

export default router;
