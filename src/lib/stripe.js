import Stripe from "stripe";

let client = null;

export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export const PREMIUM_PRICE = {
  currency: "usd",
  unitAmount: 999,
  interval: "month",
};

export function subscriptionPeriodEnd(subscription) {
  const seconds =
    subscription.items?.data?.[0]?.current_period_end ??
    subscription.current_period_end ??
    subscription.cancel_at;

  return seconds ? new Date(seconds * 1000) : null;
}

export function invoiceSubscriptionId(invoice) {
  const value =
    invoice.parent?.subscription_details?.subscription ?? invoice.subscription ?? null;
  return typeof value === "string" ? value : (value?.id ?? null);
}
