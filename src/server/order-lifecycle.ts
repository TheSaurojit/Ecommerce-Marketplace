import { db } from "@/lib/db";

export async function markOrderPaid(
  orderId: string,
  stripeSessionId: string,
  paymentIntentId: string | null
): Promise<boolean> {
  return db.$transaction(async (tx) => {
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

    const subOrders = await tx.subOrder.findMany({
      where: { orderId },
      select: {
        id: true,
        sellerId: true,
        sellerPayout: true,
      },
    });

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
}

export async function cancelPendingOrder(
  orderId: string,
  stripeSessionId?: string | null
): Promise<boolean> {
  return db.$transaction(async (tx) => {
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
}
