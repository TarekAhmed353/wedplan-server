import { ObjectId } from "mongodb";

export function toObjectId(value) {
  return typeof value === "string" && ObjectId.isValid(value) && value.length === 24
    ? new ObjectId(value)
    : null;
}
