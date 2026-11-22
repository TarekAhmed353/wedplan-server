import { MAX_SERVICE_IMAGES, SERVICE_CATEGORIES } from "../constants.js";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isImgbbUrl(value) {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "i.ibb.co";
  } catch {
    return false;
  }
}

export function validateService(body) {
  const errors = {};
  const value = {
    serviceName: cleanText(body.serviceName),
    category: cleanText(body.category),
    description: cleanText(body.description),
    price: body.price,
    location: cleanText(body.location),
    images: Array.isArray(body.images) ? body.images : [],
  };

  if (value.serviceName.length < 3 || value.serviceName.length > 100) {
    errors.serviceName = "Service name must be 3 to 100 characters";
  }

  if (!SERVICE_CATEGORIES.includes(value.category)) {
    errors.category = "Please choose one of the listed categories";
  }

  if (value.description.length < 20 || value.description.length > 2000) {
    errors.description = "Description must be 20 to 2000 characters";
  }

  if (
    typeof value.price !== "number" ||
    !Number.isInteger(value.price) ||
    value.price < 1 ||
    value.price > 10_000_000
  ) {
    errors.price = "Price must be a whole number of taka between 1 and 10,000,000";
  }

  if (value.location.length < 2 || value.location.length > 100) {
    errors.location = "Location must be 2 to 100 characters";
  }

  if (
    value.images.length < 1 ||
    value.images.length > MAX_SERVICE_IMAGES ||
    !value.images.every(isImgbbUrl)
  ) {
    errors.images = `Add 1 to ${MAX_SERVICE_IMAGES} images uploaded through WedPlan`;
  }

  return { errors, value };
}
