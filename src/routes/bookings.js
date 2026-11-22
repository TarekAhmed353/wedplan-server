import { Router } from "express";
import { ObjectId } from "mongodb";
import { collections } from "../db.js";
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

export default router;
