import { addYears, parseDateOnly, todayInDhaka } from "../lib/dates.js";
import { toObjectId } from "../lib/ids.js";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateBooking(body) {
  const errors = {};
  const today = todayInDhaka();
  const eventDateText = cleanText(body.eventDate);
  const eventDate = parseDateOnly(eventDateText);
  const value = {
    serviceId: toObjectId(body.serviceId),
    eventDate,
    eventLocation: cleanText(body.eventLocation),
    message: cleanText(body.message),
  };

  if (!value.serviceId) {
    errors.serviceId = "Service id is missing or not valid";
  }

  if (!eventDate) {
    errors.eventDate = "Choose a valid event date";
  } else if (eventDateText < today) {
    errors.eventDate = "Event date cannot be in the past";
  } else if (eventDateText > addYears(today, 2)) {
    errors.eventDate = "Event date must be within the next 2 years";
  }

  if (value.eventLocation.length < 2 || value.eventLocation.length > 200) {
    errors.eventLocation = "Event location must be 2 to 200 characters";
  }

  if (value.message.length > 1000) {
    errors.message = "Message must be 1000 characters or less";
  }

  return { errors, value };
}
