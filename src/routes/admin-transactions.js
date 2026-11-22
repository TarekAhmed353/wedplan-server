import { Router } from "express";
import { collections } from "../db.js";
import { userSummaryLookup } from "../lib/booking-views.js";

const router = Router();

const STATUSES = ["pending", "paid", "expired", "failed"];
const PAGE_SIZE = 10;

router.get("/", async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : null;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const filter = status ? { status } : {};

  const [transactions, total, summaryRows] = await Promise.all([
    collections.transactions
      .aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * PAGE_SIZE },
        { $limit: PAGE_SIZE },
        ...userSummaryLookup("vendorId", "vendor", true),
        {
          $project: {
            vendor: 1,
            plan: 1,
            amount: 1,
            currency: 1,
            status: 1,
            stripeSessionId: 1,
            stripeSubscriptionId: 1,
            stripeInvoiceId: 1,
            paidAt: 1,
            createdAt: 1,
          },
        },
      ])
      .toArray(),
    collections.transactions.countDocuments(filter),
    collections.transactions
      .aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            amount: { $sum: "$amount" },
          },
        },
      ])
      .toArray(),
  ]);

  const counts = { all: 0, pending: 0, paid: 0, expired: 0, failed: 0 };
  let revenue = 0;

  for (const row of summaryRows) {
    if (row._id in counts) counts[row._id] = row.count;
    counts.all += row.count;
    if (row._id === "paid") revenue = Math.round(row.amount * 100) / 100;
  }

  res.json({
    transactions,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    counts,
    revenue,
    currency: "usd",
  });
});

export default router;
