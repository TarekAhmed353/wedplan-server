import { ObjectId } from "mongodb";
import { FREE_SERVICE_LIMIT } from "../constants.js";
import { collections } from "../db.js";

export function isPremium(user) {
  if (user.subscriptionPlan !== "premium") {
    return false;
  }

  if (!user.subscriptionExpiresAt) {
    return true;
  }

  return new Date(user.subscriptionExpiresAt) > new Date();
}

export function activeServiceFilter(vendorId) {
  return {
    vendorId: new ObjectId(vendorId),
    isAvailable: true,
    status: { $ne: "rejected" },
  };
}

export async function hasRoomForOneMore(vendor, excludeId) {
  if (isPremium(vendor)) {
    return true;
  }

  const filter = activeServiceFilter(vendor.id ?? vendor._id.toString());

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return (await collections.services.countDocuments(filter)) < FREE_SERVICE_LIMIT;
}

export async function getPlanSummary(user) {
  const premium = isPremium(user);
  const activeServices = await collections.services.countDocuments(
    activeServiceFilter(user.id),
  );

  const latestPaid = premium
    ? await collections.transactions.findOne(
        { vendorId: new ObjectId(user.id), status: "paid", stripeSubscriptionId: { $ne: null } },
        { sort: { createdAt: -1 } },
      )
    : null;

  return {
    plan: premium ? "premium" : "free",
    activeServices,
    limit: premium ? null : FREE_SERVICE_LIMIT,
    canAddService: premium || activeServices < FREE_SERVICE_LIMIT,
    subscriptionExpiresAt: premium ? user.subscriptionExpiresAt : null,
    cancelAtPeriodEnd: Boolean(latestPaid?.cancelAtPeriodEnd),
  };
}
