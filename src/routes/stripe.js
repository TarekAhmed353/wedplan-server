import { Router } from "express";
import { ObjectId } from "mongodb";
import { clientUrl } from "../config.js";
import { collections } from "../db.js";
import { isPremium } from "../lib/plan.js";
import { getStripe, PREMIUM_PRICE } from "../lib/stripe.js";
import {
  checkNotBlocked,
  requireRoleChosen,
  verifyRole,
} from "../middleware/auth-checks.js";
import { verifyToken } from "../middleware/verify-token.js";

const router = Router();

router.use(verifyToken, checkNotBlocked, requireRoleChosen, verifyRole("vendor"));

router.post("/checkout", async (req, res) => {
  if (isPremium(req.user)) {
    return res.status(409).json({
      message: "You are already on Premium",
      code: "ALREADY_PREMIUM",
    });
  }

  const vendorId = req.user.id;

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: PREMIUM_PRICE.currency,
          unit_amount: PREMIUM_PRICE.unitAmount,
          recurring: { interval: PREMIUM_PRICE.interval },
          product_data: {
            name: "WedPlan Premium",
            description: "Unlimited active services and a Premium vendor badge",
          },
        },
      },
    ],
    customer_email: req.user.email,
    client_reference_id: vendorId,
    metadata: { vendorId },
    subscription_data: { metadata: { vendorId } },
    success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/payment/cancel`,
  });

  const now = new Date();

  await collections.transactions.insertOne({
    vendorId: new ObjectId(vendorId),
    plan: "premium",
    amount: PREMIUM_PRICE.unitAmount / 100,
    currency: PREMIUM_PRICE.currency,
    stripeSessionId: session.id,
    stripeSubscriptionId: null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  res.status(201).json({ url: session.url });
});

router.get("/session/:sessionId", async (req, res) => {
  const transaction = await collections.transactions.findOne({
    stripeSessionId: String(req.params.sessionId),
    vendorId: new ObjectId(req.user.id),
  });

  if (!transaction) {
    return res.status(404).json({ message: "Payment not found" });
  }

  res.json({
    status: transaction.status,
    amount: transaction.amount,
    currency: transaction.currency,
    plan: transaction.plan,
    isPremium: isPremium(req.user),
    subscriptionExpiresAt: isPremium(req.user) ? req.user.subscriptionExpiresAt : null,
  });
});

router.post("/cancel", async (req, res) => {
  const transaction = await collections.transactions.findOne(
    {
      vendorId: new ObjectId(req.user.id),
      status: "paid",
      stripeSubscriptionId: { $ne: null },
    },
    { sort: { createdAt: -1 } },
  );

  if (!transaction || !isPremium(req.user)) {
    return res.status(409).json({
      message: "You do not have an active Premium subscription",
      code: "NOT_PREMIUM",
    });
  }

  const subscription = await getStripe().subscriptions.update(transaction.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await collections.transactions.updateMany(
    { stripeSubscriptionId: subscription.id },
    { $set: { cancelAtPeriodEnd: true, updatedAt: new Date() } },
  );

  res.json({
    message: "Premium will end at the end of the current period",
    subscriptionExpiresAt: req.user.subscriptionExpiresAt,
  });
});

export default router;
