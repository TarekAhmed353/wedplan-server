import { collections } from "../db.js";
import { isPremium } from "./plan.js";

export const publicMatch = { status: "approved", isAvailable: true };

export const vendorLookup = [
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

export async function findBookableService(serviceId) {
  const [service] = await collections.services
    .aggregate([{ $match: { _id: serviceId, ...publicMatch } }, ...vendorLookup])
    .toArray();

  return service ?? null;
}
