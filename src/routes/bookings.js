import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../db.js";
import { toObjectId } from "../lib/ids.js";
import { findBookableService } from "../lib/public-services.js";
import {
  checkNotBlocked,
  requireRoleChosen,
  verifyRole,
} from "../middleware/auth-checks.js";
import { verifyToken } from "../middleware/verify-token.js";
import { validateBooking } from "../validators/booking.js";

const router = Router();

const customerOnly = [verifyToken, checkNotBlocked, requireRoleChosen, verifyRole("customer")];

export const ACTIVE_BOOKING_STATUSES = ["pending", "accepted"];

router.post("/", ...customerOnly, async (req, res) => {
  const { errors, value } = validateBooking(req.body ?? {});

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: "Please check the booking details", errors });
  }

  const service = await findBookableService(value.serviceId);

  if (!service) {
    return res.status(404).json({
      message: "This service does not exist or is not available for booking",
    });
  }

  const customerId = new ObjectId(req.user.id);

  if (service.vendorId.equals(customerId)) {
    return res.status(403).json({
      message: "You cannot book your own service",
      code: "OWN_SERVICE",
    });
  }

  const duplicate = await collections.bookings.findOne({
    customerId,
    serviceId: service._id,
    eventDate: value.eventDate,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  });

  if (duplicate) {
    return res.status(409).json({
      message: "You already have an active booking request for this service on that date",
      code: "DUPLICATE_BOOKING",
    });
  }

  const now = new Date();
  const booking = {
    serviceId: service._id,
    vendorId: service.vendorId,
    customerId,
    eventDate: value.eventDate,
    eventLocation: value.eventLocation,
    message: value.message,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const { insertedId } = await collections.bookings.insertOne(booking);

  res.status(201).json({ booking: { ...booking, _id: insertedId } });
});

router.patch("/:id/cancel", ...customerOnly, async (req, res) => {
  const id = toObjectId(req.params.id);
  const customerId = new ObjectId(req.user.id);

  if (!id) {
    return res.status(404).json({ message: "Booking not found" });
  }

  const now = new Date();
  const result = await collections.bookings.findOneAndUpdate(
    { _id: id, customerId, status: "pending" },
    { $set: { status: "cancelled", cancelledAt: now, updatedAt: now } },
    { returnDocument: "after" },
  );

  if (result) {
    return res.json({ booking: result });
  }

  const existing = await collections.bookings.findOne({ _id: id, customerId });

  if (!existing) {
    return res.status(404).json({ message: "Booking not found" });
  }

  res.status(409).json({
    message: `This booking is already ${existing.status} and can no longer be cancelled`,
    code: "BOOKING_NOT_PENDING",
  });
});

export default router;
