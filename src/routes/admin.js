import { Router } from "express";
import { SERVICE_CATEGORIES } from "../constants.js";
import { collections } from "../db.js";
import { toObjectId } from "../lib/ids.js";
import { hasRoomForOneMore } from "../lib/plan.js";
import { checkNotBlocked, verifyRole } from "../middleware/auth-checks.js";
import { verifyToken } from "../middleware/verify-token.js";

const router = Router();

const SERVICE_STATUSES = ["pending", "approved", "rejected"];
const PAGE_SIZE = 10;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

router.get("/services", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const status = SERVICE_STATUSES.includes(req.query.status) ? req.query.status : null;
  const category = SERVICE_CATEGORIES.includes(req.query.category) ? req.query.category : null;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

  const baseFilter = {};

  if (search) {
    baseFilter.serviceName = { $regex: escapeRegex(search), $options: "i" };
  }

  if (category) {
    baseFilter.category = category;
  }

  const filter = status ? { ...baseFilter, status } : baseFilter;

  const [result] = await collections.services
    .aggregate([
      { $match: filter },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          services: [
            { $skip: (page - 1) * PAGE_SIZE },
            { $limit: PAGE_SIZE },
            {
              $lookup: {
                from: "user",
                localField: "vendorId",
                foreignField: "_id",
                as: "vendor",
                pipeline: [
                  { $project: { _id: 1, name: 1, email: 1, businessName: 1, image: 1 } },
                ],
              },
            },
            { $set: { vendor: { $first: "$vendor" } } },
          ],
          total: [{ $count: "count" }],
        },
      },
    ])
    .toArray();

  const statusCounts = await collections.services
    .aggregate([{ $match: baseFilter }, { $group: { _id: "$status", count: { $sum: 1 } } }])
    .toArray();

  const counts = { all: 0, pending: 0, approved: 0, rejected: 0 };
  for (const { _id, count } of statusCounts) {
    if (_id in counts) counts[_id] = count;
    counts.all += count;
  }

  const total = result.total[0]?.count ?? 0;

  res.json({
    services: result.services,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts,
  });
});

router.patch("/services/:id/status", async (req, res) => {
  const { status } = req.body ?? {};

  if (!SERVICE_STATUSES.includes(status)) {
    return res
      .status(400)
      .json({ message: "Status must be pending, approved or rejected" });
  }

  const id = toObjectId(req.params.id);
  const service = id ? await collections.services.findOne({ _id: id }) : null;

  if (!service) {
    return res.status(404).json({ message: "Service not found" });
  }

  const comesBackActive =
    service.status === "rejected" && status !== "rejected" && service.isAvailable === true;

  if (comesBackActive) {
    const vendor = await collections.users.findOne({ _id: service.vendorId });

    if (vendor && !(await hasRoomForOneMore(vendor, service._id))) {
      return res.status(409).json({
        message:
          "This vendor already has 3 active services on the free plan. Ask them to switch one off first",
        code: "VENDOR_AT_LIMIT",
      });
    }
  }

  const updatedAt = new Date();

  await collections.services.updateOne({ _id: service._id }, { $set: { status, updatedAt } });

  res.json({ service: { ...service, status, updatedAt } });
});

router.delete("/services/:id", async (req, res) => {
  const id = toObjectId(req.params.id);
  const { deletedCount } = id
    ? await collections.services.deleteOne({ _id: id })
    : { deletedCount: 0 };

  if (deletedCount === 0) {
    return res.status(404).json({ message: "Service not found" });
  }

  res.json({ message: "Service deleted", id });
});

export default router;
