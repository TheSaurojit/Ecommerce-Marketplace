import { db } from "@/lib/db";
import { broadcastRealtimeEvent } from "@/lib/realtime";

export async function markOrderPaid(
  orderId: string,
  stripeSessionId: string,
  paymentIntentId: string | null
): Promise<boolean> {
  let buyerId: string | null = null;
  let notifiedSubOrders: Array<{ id: string; sellerId: string; sellerPayout: unknown }> = [];

  const success = await db.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: {
        id: orderId,
        stripeSessionId,
        paymentStatus: "PAYMENT_PENDING",
      },
      data: {
        paymentStatus: "PAID",
        ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
      },
    });

    if (result.count !== 1) {
      return false;
    }

    const orderRecord = await tx.order.findUnique({
      where: { id: orderId },
      select: { buyerId: true },
    });
    if (orderRecord) {
      buyerId = orderRecord.buyerId;
    }

    const subOrders = await tx.subOrder.findMany({
      where: {
        orderId,
        status: { notIn: ["CANCELLED", "REFUNDED"] },
      },
      select: {
        id: true,
        sellerId: true,
        sellerPayout: true,
      },
    });

    notifiedSubOrders = subOrders;

    for (const subOrder of subOrders) {
      await tx.payoutRecord.create({
        data: {
          sellerId: subOrder.sellerId,
          subOrderId: subOrder.id,
          amount: subOrder.sellerPayout,
          status: "PENDING",
        },
      });
    }

    return true;
  });

  if (success) {
    if (buyerId) {
      broadcastRealtimeEvent(`buyer:orders:${buyerId}`, "order:paid", {
        orderId,
        paymentStatus: "PAID",
      });
    }
    for (const subOrder of notifiedSubOrders) {
      broadcastRealtimeEvent(`seller:orders:${subOrder.sellerId}`, "order:new", {
        subOrderId: subOrder.id,
        orderId,
        amount: Number(subOrder.sellerPayout),
      });
    }
  }

  return success;
}

export async function cancelPendingOrder(
  orderId: string,
  stripeSessionId?: string | null
): Promise<boolean> {
  const restoredItems: Array<{ productId: string; quantity: number }> = [];

  const success = await db.$transaction(async (tx) => {
    const where: {
      id: string;
      paymentStatus: "PAYMENT_PENDING";
      stripeSessionId?: string | null;
    } = {
      id: orderId,
      paymentStatus: "PAYMENT_PENDING",
    };

    if (stripeSessionId !== undefined) {
      where.stripeSessionId = stripeSessionId;
    }

    const result = await tx.order.updateMany({
      where,
      data: { paymentStatus: "CANCELLED" },
    });

    if (result.count !== 1) {
      return false;
    }

    const subOrders = await tx.subOrder.findMany({
      where: { orderId },
      select: {
        id: true,
        items: {
          select: { productId: true, quantity: true },
        },
      },
    });

    for (const subOrder of subOrders) {
      for (const item of subOrder.items) {
        restoredItems.push(item);
        await tx.product.update({
          where: { id: item.productId },
          data: { inventoryCount: { increment: item.quantity } },
        });
      }

      await tx.subOrder.update({
        where: { id: subOrder.id },
        data: { status: "CANCELLED" },
      });

      await tx.payoutRecord.updateMany({
        where: { subOrderId: subOrder.id },
        data: { status: "FAILED" },
      });
    }

    return true;
  });

  if (success && restoredItems.length > 0) {
    for (const item of restoredItems) {
      broadcastRealtimeEvent(`product:stock:${item.productId}`, "stock:updated", {
        productId: item.productId,
        delta: item.quantity,
      });
    }
  }

  return success;
}
