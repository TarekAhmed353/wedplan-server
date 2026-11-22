import { collections } from "../db.js";
import {
  getStripe,
  invoiceSubscriptionId,
  subscriptionPeriodEnd,
} from "../lib/stripe.js";

const ENDED_STATUSES = ["canceled", "unpaid", "incomplete_expired"];

async function setVendorPremium(vendorId, expiresAt) {
  await collections.users.updateOne(
    { _id: vendorId },
    {
      $set: {
        subscriptionPlan: "premium",
        subscriptionExpiresAt: expiresAt,
        updatedAt: new Date(),
      },
    },
  );
}

async function setVendorFree(vendorId) {
  await collections.users.updateOne(
    { _id: vendorId },
    { $set: { subscriptionPlan: "free", subscriptionExpiresAt: null, updatedAt: new Date() } },
  );
}

async function findVendorIdForSubscription(subscriptionId) {
  const transaction = await collections.transactions.findOne(
    { stripeSubscriptionId: subscriptionId },
    { sort: { createdAt: -1 } },
  );
  return transaction?.vendorId ?? null;
}

async function handleCheckoutPaid(session) {
  if (session.mode !== "subscription" || session.payment_status !== "paid") {
    return;
  }

  const transaction = await collections.transactions.findOne({ stripeSessionId: session.id });

  if (!transaction) {
    console.warn(`Stripe webhook: no transaction for session ${session.id}`);
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const expiresAt = subscriptionPeriodEnd(subscription);
  const now = new Date();

  await collections.transactions.updateOne(
    { _id: transaction._id, status: { $ne: "paid" } },
    {
      $set: {
        status: "paid",
        stripeSubscriptionId: subscription.id,
        stripeCustomerId:
          typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
        amount: (session.amount_total ?? 0) / 100,
        currency: session.currency ?? "usd",
        periodEnd: expiresAt,
        cancelAtPeriodEnd: false,
        paidAt: now,
        updatedAt: now,
      },
    },
  );

  await setVendorPremium(transaction.vendorId, expiresAt);
}

async function handleCheckoutClosed(session, status) {
  await collections.transactions.updateOne(
    { stripeSessionId: session.id, status: "pending" },
    { $set: { status, updatedAt: new Date() } },
  );
}

async function handleInvoicePaid(invoice) {
  if (invoice.billing_reason === "subscription_create") {
    return;
  }

  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return;

  const vendorId = await findVendorIdForSubscription(subscriptionId);
  if (!vendorId) return;

  const exists = await collections.transactions.findOne({ stripeInvoiceId: invoice.id });
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  const expiresAt = subscriptionPeriodEnd(subscription);
  const now = new Date();

  if (!exists) {
    await collections.transactions.insertOne({
      vendorId,
      plan: "premium",
      amount: (invoice.amount_paid ?? 0) / 100,
      currency: invoice.currency ?? "usd",
      stripeSessionId: null,
      stripeSubscriptionId: subscriptionId,
      stripeInvoiceId: invoice.id,
      status: "paid",
      periodEnd: expiresAt,
      paidAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  await setVendorPremium(vendorId, expiresAt);
}

async function handleSubscriptionChanged(subscription, deleted) {
  const vendorId = await findVendorIdForSubscription(subscription.id);
  if (!vendorId) return;

  await collections.transactions.updateMany(
    { stripeSubscriptionId: subscription.id },
    {
      $set: {
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        updatedAt: new Date(),
      },
    },
  );

  if (deleted || ENDED_STATUSES.includes(subscription.status)) {
    await setVendorFree(vendorId);
    return;
  }

  if (subscription.status === "active" || subscription.status === "trialing") {
    await setVendorPremium(vendorId, subscriptionPeriodEnd(subscription));
  }
}

export async function stripeWebhook(req, res) {
  let event;

  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return res.status(400).json({ message: "Invalid Stripe signature" });
  }

  try {
    const object = event.data.object;

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutPaid(object);
        break;
      case "checkout.session.expired":
        await handleCheckoutClosed(object, "expired");
        break;
      case "checkout.session.async_payment_failed":
        await handleCheckoutClosed(object, "failed");
        break;
      case "invoice.paid":
        await handleInvoicePaid(object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionChanged(object, false);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionChanged(object, true);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(`Stripe webhook ${event.type} failed:`, error);
    return res.status(500).json({ message: "Webhook handling failed" });
  }

  res.json({ received: true });
}
