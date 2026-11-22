import { Router } from "express";
import { ObjectId } from "mongodb";
import { SERVICE_CATEGORIES } from "../constants.js";
import { collections } from "../db.js";
import { toObjectId } from "../lib/ids.js";
import { getPlanSummary, hasRoomForOneMore, isPremium } from "../lib/plan.js";
import { escapeRegex } from "../lib/text.js";
import {
  checkNotBlocked,
  requireRoleChosen,
  verifyRole,
} from "../middleware/auth-checks.js";
import { verifyToken } from "../middleware/verify-token.js";
import { validateService } from "../validators/service.js";

const router = Router();

const vendorOnly = [verifyToken, checkNotBlocked, requireRoleChosen, verifyRole("vendor")];

const limitReached = {
  message: "The free plan allows 3 active services. Upgrade to Premium to add more",
  code: "FREE_LIMIT_REACHED",
};

function isActive(service) {
  return service.isAvailable === true && service.status !== "rejected";
}

async function findOwnService(req, res) {
  const id = toObjectId(req.params.id);
  const service = id
    ? await collections.services.findOne({
        _id: id,
        vendorId: new ObjectId(req.user.id),
      })
    : null;

  if (!service) {
    res.status(404).json({ message: "Service not found" });
    return null;
  }

  return service;
}

const PUBLIC_PAGE_SIZE = 12;

const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  "price-asc": { price: 1, _id: 1 },
  "price-desc": { price: -1, _id: -1 },
};

const publicMatch = { status: "approved", isAvailable: true };

const vendorLookup = [
  {
    $lookup: {
      from: "user",
      localField: "vendorId",
      foreignField: "_id",
      as: "vendor",
      pipeline: [
        {
          $project: {
            name: 1,
            businessName: 1,
            image: 1,
            isBlocked: 1,
            subscriptionPlan: 1,
            subscriptionExpiresAt: 1,
          },
        },
      ],
    },
  },
  { $set: { vendor: { $first: "$vendor" } } },
  { $match: { vendor: { $ne: null }, "vendor.isBlocked": { $ne: true } } },
];

export function toPublicVendor(vendor) {
  return {
    _id: vendor._id,
    name: vendor.name,
    businessName: vendor.businessName ?? null,
    image: vendor.image ?? null,
    isPremium: isPremium(vendor),
  };
}

function searchFilter(search) {
  const words = search.split(/\s+/).filter(Boolean).slice(0, 8);

  if (words.length === 0) {
    return {};
  }

  return {
    $and: words.map((word) => {
      const pattern = { $regex: escapeRegex(word), $options: "i" };
      return {
        $or: [
          { serviceName: pattern },
          { description: pattern },
          { category: pattern },
          { location: pattern },
        ],
      };
    }),
  };
}

router.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  const category = SERVICE_CATEGORIES.includes(req.query.category) ? req.query.category : null;
  const location =
    typeof req.query.location === "string" ? req.query.location.trim().slice(0, 100) : "";
  const sort = SORTS[req.query.sort] ? req.query.sort : "newest";
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);

  const match = { ...publicMatch, ...searchFilter(search) };

  if (category) {
    match.category = category;
  }

  if (location) {
    match.location = { $regex: `^\\s*${escapeRegex(location)}\\s*$`, $options: "i" };
  }

  const [result] = await collections.services
    .aggregate([
      { $match: match },
      ...vendorLookup,
      { $sort: SORTS[sort] },
      {
        $facet: {
          services: [
            { $skip: (page - 1) * PUBLIC_PAGE_SIZE },
            { $limit: PUBLIC_PAGE_SIZE },
            { $project: { description: 0 } },
          ],
          total: [{ $count: "count" }],
        },
      },
    ])
    .toArray();

  const total = result.total[0]?.count ?? 0;

  res.json({
    services: result.services.map((service) => ({
      ...service,
      vendor: toPublicVendor(service.vendor),
    })),
    total,
    page,
    pageSize: PUBLIC_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PUBLIC_PAGE_SIZE)),
    sort,
  });
});

router.get("/locations", async (req, res) => {
  const rows = await collections.services
    .aggregate([
      { $match: publicMatch },
      ...vendorLookup,
      {
        $group: {
          _id: { $toLower: { $trim: { input: "$location" } } },
          location: { $first: { $trim: { input: "$location" } } },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  res.json({ locations: rows.map((row) => row.location) });
});

router.post("/", ...vendorOnly, async (req, res) => {
  const { errors, value } = validateService(req.body ?? {});

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: "Please check the service details", errors });
  }

  const plan = await getPlanSummary(req.user);

  if (!plan.canAddService) {
    return res.status(403).json(limitReached);
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
});

router.patch("/:id", ...vendorOnly, async (req, res) => {
  const service = await findOwnService(req, res);
  if (!service) return;

  const { errors, value } = validateService(req.body ?? {});

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: "Please check the service details", errors });
  }

  const becomesActive = !isActive(service) && service.isAvailable === true;

  if (becomesActive && !(await hasRoomForOneMore(req.user, service._id))) {
    return res.status(403).json(limitReached);
  }

  const update = { ...value, status: "pending", updatedAt: new Date() };

  await collections.services.updateOne({ _id: service._id }, { $set: update });

  res.json({ service: { ...service, ...update } });
});

router.patch("/:id/availability", ...vendorOnly, async (req, res) => {
  const { isAvailable } = req.body ?? {};

  if (typeof isAvailable !== "boolean") {
    return res.status(400).json({ message: "isAvailable must be true or false" });
  }

  const service = await findOwnService(req, res);
  if (!service) return;

  const turningOn = isAvailable && !service.isAvailable;

  if (
    turningOn &&
    service.status !== "rejected" &&
    !(await hasRoomForOneMore(req.user, service._id))
  ) {
    return res.status(403).json(limitReached);
  }

  const updatedAt = new Date();

  await collections.services.updateOne(
    { _id: service._id },
    { $set: { isAvailable, updatedAt } },
  );

  res.json({ service: { ...service, isAvailable, updatedAt } });
});

router.delete("/:id", ...vendorOnly, async (req, res) => {
  const service = await findOwnService(req, res);
  if (!service) return;

  await collections.services.deleteOne({ _id: service._id });

  res.json({ message: "Service deleted", id: service._id });
});

export default router;
