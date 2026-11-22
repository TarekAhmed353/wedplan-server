import { Router } from "express";
import { ObjectId } from "mongodb";
import { FREE_SERVICE_LIMIT } from "../constants.js";
import { collections } from "../db.js";
import { toObjectId } from "../lib/ids.js";
import { activeServiceFilter, getPlanSummary, isPremium } from "../lib/plan.js";
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

async function hasRoomForOneMore(user, excludeId) {
  if (isPremium(user)) {
    return true;
  }

  const filter = activeServiceFilter(user.id);

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return (await collections.services.countDocuments(filter)) < FREE_SERVICE_LIMIT;
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
