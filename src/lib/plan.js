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

export async function getPlanSummary(user) {
  const premium = isPremium(user);
  const activeServices = await collections.services.countDocuments(
    activeServiceFilter(user.id),
  );

  return {
    plan: premium ? "premium" : "free",
    activeServices,
    limit: premium ? null : FREE_SERVICE_LIMIT,
    canAddService: premium || activeServices < FREE_SERVICE_LIMIT,
    subscriptionExpiresAt: premium ? user.subscriptionExpiresAt : null,
  };
}
