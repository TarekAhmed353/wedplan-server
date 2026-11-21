import { createRemoteJWKSet, jwtVerify } from "jose";
import { ObjectId } from "mongodb";
import { clientUrl } from "../config.js";
import { collections } from "../db.js";

const jwks = createRemoteJWKSet(new URL("/api/auth/jwks", clientUrl));

function isTokenError(error) {
  return (
    typeof error?.code === "string" &&
    error.code.startsWith("ERR_J") &&
    error.code !== "ERR_JWKS_TIMEOUT"
  );
}

export async function verifyToken(req, res, next) {
  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Please sign in to continue" });
  }

  let payload;

  try {
    ({ payload } = await jwtVerify(token, jwks, {
      issuer: clientUrl,
      audience: clientUrl,
    }));
  } catch (error) {
    if (!isTokenError(error)) {
      return next(error);
    }

    const message =
      error.code === "ERR_JWT_EXPIRED"
        ? "Your session has expired. Please sign in again"
        : "Invalid token. Please sign in again";

    return res.status(401).json({ message });
  }

  if (!payload.sub || !ObjectId.isValid(payload.sub)) {
    return res.status(401).json({ message: "Invalid token. Please sign in again" });
  }

  const user = await collections.users.findOne({
    _id: new ObjectId(payload.sub),
  });

  if (!user) {
    return res.status(401).json({ message: "Account not found. Please sign in again" });
  }

  req.user = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    role: user.role ?? null,
    roleChosen: user.roleChosen !== false,
    isBlocked: user.isBlocked === true,
    businessName: user.businessName ?? null,
    subscriptionPlan: user.subscriptionPlan ?? "free",
    subscriptionExpiresAt: user.subscriptionExpiresAt ?? null,
  };

  next();
}
