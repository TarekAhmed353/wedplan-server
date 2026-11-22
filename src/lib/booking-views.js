export const BOOKING_STATUSES = ["pending", "accepted", "rejected", "cancelled"];

export const serviceSummaryLookup = [
  {
    $lookup: {
      from: "services",
      localField: "serviceId",
      foreignField: "_id",
      as: "service",
      pipeline: [
        {
          $project: {
            serviceName: 1,
            images: { $slice: ["$images", 1] },
            category: 1,
            price: 1,
            location: 1,
          },
        },
      ],
    },
  },
  { $set: { service: { $first: "$service" } } },
];

export function userSummaryLookup(localField, as, withEmail) {
  return [
    {
      $lookup: {
        from: "user",
        localField,
        foreignField: "_id",
        as,
        pipeline: [
          {
            $project: {
              name: 1,
              businessName: 1,
              image: 1,
              ...(withEmail ? { email: 1 } : {}),
            },
          },
        ],
      },
    },
    { $set: { [as]: { $first: `$${as}` } } },
  ];
}

export function emptyStatusCounts() {
  return { all: 0, pending: 0, accepted: 0, rejected: 0, cancelled: 0 };
}

export function toStatusCounts(rows) {
  const counts = emptyStatusCounts();

  for (const { _id, count } of rows) {
    if (_id in counts) counts[_id] = count;
    counts.all += count;
  }

  return counts;
}
