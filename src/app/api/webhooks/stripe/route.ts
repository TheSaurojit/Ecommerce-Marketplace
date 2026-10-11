import { NextRequest, NextResponse } from "next/server";
import { stripe, stripeWebhookSecret, isStripeConfigured } from "@/lib/stripe";
import { db } from "@/lib/db";
import { cancelPendingOrder, markOrderPaid } from "@/server/order-lifecycle";
import Stripe from "stripe";

function getOrderId(session: Stripe.Checkout.Session): string | null {
  return session.client_reference_id || session.metadata?.orderId || null;
}

async function reconcilePaidSession(
  session: Stripe.Checkout.Session,
  eventType: string
): Promise<void> {
  if (session.payment_status !== "paid") {
    return;
  }

  const orderId = getOrderId(session);
  if (!orderId) {
    console.error(`[Stripe Webhook]: ${eventType} did not include an order ID`);
    return;
  }

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, paymentStatus: true, stripeSessionId: true, totalAmount: true },
  });

  if (
    !order ||
    order.stripeSessionId !== session.id ||
    session.currency !== "inr" ||
    session.amount_total !== Math.round(Number(order.totalAmount) * 100)
  ) {
    console.error(`[Stripe Webhook]: ${eventType} did not match order ${orderId}`);
    return;
  }

  if (order.paymentStatus === "PAID") {
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;
  const updated = await markOrderPaid(order.id, session.id, paymentIntentId);

  if (updated) {
    console.log(`[Stripe Webhook]: Order ${orderId} reconciled to PAID via ${eventType}`);
  } else {
    console.warn(`[Stripe Webhook]: Order ${orderId} was not pending when ${eventType} arrived`);
  }
}

export async function POST(req: NextRequest) {
  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json(
      { error: "Stripe payment service is not configured on this server." },
      { status: 503 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature || !stripeWebhookSecret) {
    return NextResponse.json(
      { error: "Missing stripe-signature header or webhook secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Stripe Webhook Signature Error]: ${message}`);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await reconcilePaidSession(session, event.type);
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await reconcilePaidSession(session, event.type);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = getOrderId(session);

        if (orderId && session.status === "expired" && session.payment_status !== "paid") {
          const cancelled = await cancelPendingOrder(orderId, session.id);
          if (cancelled) {
            console.log(`[Stripe Webhook]: Order ${orderId} expired. Stock restored and order cancelled.`);
          }
        }
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = getOrderId(session);

        if (orderId && session.payment_status !== "paid") {
          const cancelled = await cancelPendingOrder(orderId, session.id);
          if (cancelled) {
            console.log(`[Stripe Webhook]: Async payment failed for order ${orderId}; stock restored.`);
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.warn(`[Stripe Webhook]: PaymentIntent ${paymentIntent.id} failed: ${paymentIntent.last_payment_error?.message}`);
        break;
      }

      default:
        // Other events can be safely acknowledged
        break;
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Stripe Webhook Execution Error]: ${message}`);
    return NextResponse.json(
      { error: "Webhook handler encountered an error processing event" },
      { status: 500 }
    );
  }
}
