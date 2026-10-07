import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
export const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
export const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Validates whether real Stripe credentials have been provided.
 */
export function isStripeConfigured(): boolean {
  if (!stripeSecretKey) return false;
  if (stripeSecretKey.includes("placeholder") || !stripeSecretKey.startsWith("sk_")) {
    return false;
  }
  return true;
}

export const stripe = isStripeConfigured() && stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      typescript: true,
    })
  : null;

export interface StripeCheckoutItem {
  title: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string | null;
  storeName?: string;
}

/**
 * Creates a Stripe Checkout Session for multi-vendor checkout.
 */
export async function createStripeCheckoutSession({
  orderId,
  buyerEmail,
  buyerId,
  items,
  appUrl,
}: {
  orderId: string;
  buyerEmail: string;
  buyerId: string;
  items: StripeCheckoutItem[];
  appUrl: string;
}): Promise<{ sessionId: string; url: string | null }> {
  if (!stripe) {
    throw new Error(
      "Stripe client is not initialized. Please verify that STRIPE_SECRET_KEY is set in your environment variables."
    );
  }

  const baseUrl = appUrl.replace(/\/+$/, "");

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => {
    const images: string[] = [];
    if (item.imageUrl && item.imageUrl.startsWith("http")) {
      images.push(item.imageUrl);
    }

    return {
      price_data: {
        currency: "inr",
        product_data: {
          name: item.title,
          images: images.length > 0 ? images : undefined,
          description: item.storeName ? `Sold by ${item.storeName}` : undefined,
        },
        unit_amount: Math.round(Number(item.unitPrice) * 100),
      },
      quantity: item.quantity,
    };
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    customer_email: buyerEmail,
    client_reference_id: orderId,
    metadata: {
      orderId,
      buyerId,
    },
    success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
    cancel_url: `${baseUrl}/checkout?cancelled=true&order_id=${orderId}`,
  });

  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Retrieves and verifies payment status for a checkout session.
 */
export async function verifyStripeCheckoutSession(sessionId: string): Promise<{
  sessionId: string;
  paid: boolean;
  paymentIntentId: string | null;
  orderId: string | null;
  status: Stripe.Checkout.Session.PaymentStatus;
  amountTotal: number | null;
  currency: string | null;
}> {
  if (!stripe) {
    throw new Error(
      "Stripe client is not initialized. Please verify that STRIPE_SECRET_KEY is set in your environment variables."
    );
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      sessionId: session.id,
      paid: session.payment_status === "paid",
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null,
      orderId: (session.client_reference_id || session.metadata?.orderId) || null,
      status: session.payment_status,
      amountTotal: session.amount_total,
      currency: session.currency,
    };
  } catch (err: unknown) {
    console.error("[Stripe Session Verification Error]:", err);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to verify Stripe checkout session: ${message}`);
  }
}

export async function expireStripeCheckoutSession(
  sessionId: string
): Promise<{
  status: Stripe.Checkout.Session["status"];
  paymentStatus: Stripe.Checkout.Session.PaymentStatus;
}> {
  if (!stripe) {
    throw new Error(
      "Stripe client is not initialized. Please verify that STRIPE_SECRET_KEY is set in your environment variables."
    );
  }

  const currentSession = await stripe.checkout.sessions.retrieve(sessionId);
  if (currentSession.status !== "open") {
    return {
      status: currentSession.status,
      paymentStatus: currentSession.payment_status,
    };
  }

  const expiredSession = await stripe.checkout.sessions.expire(sessionId);
  return {
    status: expiredSession.status,
    paymentStatus: expiredSession.payment_status,
  };
}
