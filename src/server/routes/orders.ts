import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionMiddleware, requireAuth, requireSeller, Env } from "../middleware/auth";
import {
  expireStripeCheckoutSession,
  isStripeConfigured,
  createStripeCheckoutSession,
  verifyStripeCheckoutSession,
} from "@/lib/stripe";
import { cancelPendingOrder, markOrderPaid } from "../order-lifecycle";

export const orderRoutes = new Hono<Env>()
  .use("*", sessionMiddleware)

  // 1. Multi-Vendor Checkout Creation & Splitting
  .post(
    "/checkout",
    requireAuth,
    zValidator(
      "json",
      z.object({
        items: z
          .array(
            z.object({
              productId: z.string(),
              quantity: z
                .number()
                .int()
                .positive("Quantity must be at least 1")
                .max(99, "Quantity per item cannot exceed 99 units"),
            })
          )
          .min(1, "Cart cannot be empty"),
        shippingAddress: z.object({
          fullName: z.string().min(2),
          addressLine: z.string().min(5),
          city: z.string().min(2),
          state: z.string().min(2),
          postalCode: z.string().min(3),
          country: z.string().min(2),
        }),
      })
    ),
    async (c) => {
      const user = c.get("user")!;
      const { items, shippingAddress } = c.req.valid("json");

      // Consolidate duplicate products in the checkout payload
      const consolidatedItemMap = new Map<string, number>();
      for (const item of items) {
        consolidatedItemMap.set(
          item.productId,
          (consolidatedItemMap.get(item.productId) || 0) + item.quantity
        );
      }
      const consolidatedItems = Array.from(consolidatedItemMap.entries()).map(
        ([productId, quantity]) => ({ productId, quantity })
      );

      // Fetch products to verify price, status, seller, and stock
      const productIds = consolidatedItems.map((i) => i.productId);
      const dbProducts = await db.product.findMany({
        where: { id: { in: productIds } },
        include: {
          seller: true,
          images: { take: 1, orderBy: { sortOrder: "asc" } },
        },
      });

      if (dbProducts.length !== productIds.length) {
        return c.json({ error: "One or more products in your cart are no longer available" }, 400);
      }

      // Check stock and group items by seller
      type ItemGroup = {
        seller: (typeof dbProducts)[0]["seller"];
        items: {
          product: (typeof dbProducts)[0];
          quantity: number;
          unitPrice: number;
          lineTotal: number;
        }[];
        subtotal: number;
        commissionAmount: number;
        sellerPayout: number;
      };

      const sellerGroups = new Map<string, ItemGroup>();

      for (const item of consolidatedItems) {
        const prod = dbProducts.find((p) => p.id === item.productId)!;

        if (prod.status !== "PUBLISHED") {
          return c.json({ error: `Product "${prod.title}" is currently unavailable` }, 400);
        }

        if (prod.seller.status !== "APPROVED") {
          return c.json(
            { error: `Merchant "${prod.seller.storeName}" is currently not accepting new orders.` },
            400
          );
        }

        if (prod.inventoryCount < item.quantity) {
          return c.json(
            {
              error: `Insufficient inventory for "${prod.title}". Only ${prod.inventoryCount} left.`,
            },
            400
          );
        }

        // Fixed-precision currency math (cent-level precision, prevents IEEE 754 float artifacts)
        const unitPrice = Number(prod.price);
        const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;

        if (!sellerGroups.has(prod.sellerId)) {
          sellerGroups.set(prod.sellerId, {
            seller: prod.seller,
            items: [],
            subtotal: 0,
            commissionAmount: 0,
            sellerPayout: 0,
          });
        }

        const group = sellerGroups.get(prod.sellerId)!;
        group.items.push({
          product: prod,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
        });
        group.subtotal = Math.round((group.subtotal + lineTotal) * 100) / 100;
      }

      // Calculate commission & payouts for each seller and aggregate order total
      let orderTotal = 0;
      for (const group of sellerGroups.values()) {
        const commissionRate = group.seller.commissionRate || 0.1;
        group.commissionAmount = Math.round(group.subtotal * commissionRate * 100) / 100;
        group.sellerPayout = Math.round((group.subtotal - group.commissionAmount) * 100) / 100;
        orderTotal = Math.round((orderTotal + group.subtotal) * 100) / 100;
      }

      if (!isStripeConfigured()) {
        return c.json(
          {
            error:
              "Stripe payment provider is not configured. Please supply a valid STRIPE_SECRET_KEY in your environment variables.",
          },
          503
        );
      }

      // Execute Atomic Database Transaction with Concurrency-Safe Stock Reservation
      try {
        let checkoutSessionUrl: string | null = null;
        let checkoutSessionId: string | null = null;

        const result = await db.$transaction(async (tx) => {
          // 1. Concurrency-Safe Atomic Stock Reservation (Executed FIRST)
          for (const item of consolidatedItems) {
            const updateResult = await tx.product.updateMany({
              where: {
                id: item.productId,
                inventoryCount: { gte: item.quantity },
                status: "PUBLISHED",
              },
              data: {
                inventoryCount: { decrement: item.quantity },
              },
            });

            if (updateResult.count === 0) {
              const outOfStockProd = dbProducts.find((p) => p.id === item.productId);
              throw new Error(
                `Product "${outOfStockProd?.title || item.productId}" ran out of stock during checkout. Please reduce quantity or try again.`
              );
            }
          }

          // 2. Create Parent Order
          const parentOrder = await tx.order.create({
            data: {
              buyerId: user.userId,
              totalAmount: orderTotal,
              paymentStatus: "PAYMENT_PENDING",
              shippingAddress,
            },
          });

          const createdSubOrders = [];

          // 3. Create Sub-Orders for each Seller
          for (const [sellerId, group] of sellerGroups.entries()) {
            const subOrder = await tx.subOrder.create({
              data: {
                orderId: parentOrder.id,
                sellerId: sellerId,
                subtotal: group.subtotal,
                commissionAmount: group.commissionAmount,
                sellerPayout: group.sellerPayout,
                status: "PROCESSING",
                items: {
                  create: group.items.map((i) => ({
                    productId: i.product.id,
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                  })),
                },
              },
              include: {
                items: { include: { product: true } },
              },
            });

            // 4. Create Payout Record
            await tx.payoutRecord.create({
              data: {
                sellerId: sellerId,
                subOrderId: subOrder.id,
                amount: group.sellerPayout,
                status: "PENDING",
              },
            });

            createdSubOrders.push(subOrder);
          }

          // 5. Initialize Stripe Checkout Session
          const stripeItems = consolidatedItems.map((i) => {
            const prod = dbProducts.find((p) => p.id === i.productId)!;
            return {
              title: prod.title,
              unitPrice: Number(prod.price),
              quantity: i.quantity,
              imageUrl: prod.images?.[0]?.url,
              storeName: prod.seller.storeName,
            };
          });

          const session = await createStripeCheckoutSession({
            orderId: parentOrder.id,
            buyerEmail: user.email,
            buyerId: user.userId,
            items: stripeItems,
            appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          });

          if (!session || !session.url) {
            throw new Error("Failed to initialize Stripe Checkout session.");
          }

          checkoutSessionUrl = session.url;
          checkoutSessionId = session.sessionId;

          await tx.order.update({
            where: { id: parentOrder.id },
            data: { stripeSessionId: session.sessionId },
          });

          return { parentOrder, subOrders: createdSubOrders };
        });

        return c.json(
          {
            success: true,
            message: "Stripe Checkout session initialized",
            orderId: result.parentOrder.id,
            subOrderCount: result.subOrders.length,
            totalAmount: orderTotal,
            checkoutUrl: checkoutSessionUrl,
            stripeSessionId: checkoutSessionId,
          },
          201
        );
      } catch (err: unknown) {
        return c.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Failed to complete checkout due to inventory changes. Please refresh and try again.",
          },
          400
        );
      }
    }
  )

  // 2. Confirm Stripe Payment (called upon redirect from Stripe checkout)
  .post(
    "/confirm-payment",
    requireAuth,
    zValidator(
      "json",
      z.object({
        sessionId: z.string().min(1),
        orderId: z.string().min(1),
      })
    ),
    async (c) => {
      const user = c.get("user")!;
      const { sessionId, orderId } = c.req.valid("json");

      const order = await db.order.findUnique({
        where: { id: orderId },
        include: {
          subOrders: {
            include: {
              seller: {
                select: {
                  storeName: true,
                  storeSlug: true,
                  logoUrl: true,
                },
              },
              items: {
                include: {
                  product: {
                    include: {
                      images: { take: 1, orderBy: { sortOrder: "asc" } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!order) {
        return c.json({ error: "Order not found" }, 404);
      }

      if (user.role !== "ADMIN" && order.buyerId !== user.userId) {
        return c.json({ error: "Forbidden: You can only confirm your own orders" }, 403);
      }

      if (order.stripeSessionId !== sessionId) {
        return c.json({ error: "Stripe session does not match this order" }, 400);
      }

      // If already marked as PAID
      if (order.paymentStatus === "PAID") {
        return c.json({ success: true, order, alreadyPaid: true });
      }

      if (!isStripeConfigured()) {
        return c.json(
          { error: "Stripe payment service is not configured on this server." },
          503
        );
      }

      try {
        const verification = await verifyStripeCheckoutSession(sessionId);
        const expectedAmount = Math.round(Number(order.totalAmount) * 100);

        if (
          !verification.paid ||
          verification.sessionId !== order.stripeSessionId ||
          verification.orderId !== order.id ||
          verification.amountTotal !== expectedAmount ||
          verification.currency !== "inr"
        ) {
          return c.json(
            { error: "Stripe payment could not be verified for this order", paid: false },
            400
          );
        }

        await markOrderPaid(order.id, verification.sessionId, verification.paymentIntentId);

        const updated = await db.order.findUnique({
          where: { id: order.id },
          include: {
            subOrders: {
              include: {
                seller: { select: { storeName: true, storeSlug: true, logoUrl: true } },
                items: {
                  include: {
                    product: {
                      include: {
                        images: { take: 1, orderBy: { sortOrder: "asc" } },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (!updated) {
          return c.json({ error: "Order not found" }, 404);
        }

        if (updated.paymentStatus !== "PAID") {
          return c.json(
            { error: "Order is no longer pending payment", paymentStatus: updated.paymentStatus },
            409
          );
        }

        return c.json({ success: true, order: updated, confirmed: true });
      } catch (err: unknown) {
        return c.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Failed to verify Stripe payment transaction.",
          },
          400
        );
      }
    }
  )

  // 3. Cancel Abandoned / Pending Checkout
  .post(
    "/cancel-checkout",
    requireAuth,
    zValidator(
      "json",
      z.object({
        orderId: z.string().min(1),
      })
    ),
    async (c) => {
      const user = c.get("user")!;
      const { orderId } = c.req.valid("json");

      const order = await db.order.findUnique({
        where: { id: orderId },
        include: {
          subOrders: {
            include: { items: true },
          },
        },
      });

      if (!order) {
        return c.json({ error: "Order not found" }, 404);
      }

      if (user.role !== "ADMIN" && order.buyerId !== user.userId) {
        return c.json({ error: "Forbidden: You can only cancel your own pending orders" }, 403);
      }

      if (order.paymentStatus !== "PAYMENT_PENDING") {
        return c.json({
          message: "Order is not in pending state",
          paymentStatus: order.paymentStatus,
        });
      }

      if (!isStripeConfigured()) {
        return c.json({ error: "Stripe payment service is not configured on this server." }, 503);
      }

      if (!order.stripeSessionId) {
        return c.json({ error: "Pending order has no Stripe Checkout Session" }, 409);
      }

      const session = await expireStripeCheckoutSession(order.stripeSessionId);
      if (session.status !== "expired" || session.paymentStatus === "paid") {
        return c.json(
          {
            error: "Checkout is complete or payment is processing; inventory was not released.",
            paymentStatus: order.paymentStatus,
          },
          409
        );
      }

      const cancelled = await cancelPendingOrder(order.id, order.stripeSessionId);
      if (!cancelled) {
        const currentOrder = await db.order.findUnique({
          where: { id: order.id },
          select: { paymentStatus: true },
        });
        return c.json(
          {
            error: "Order state changed before cancellation could be completed.",
            paymentStatus: currentOrder?.paymentStatus,
          },
          409
        );
      }

      return c.json({ success: true, message: "Pending checkout cancelled and inventory restored." });
    }
  )

  // 4. Buyer's Order History (Paginated)
  .get(
    "/my-orders",
    requireAuth,
    zValidator(
      "query",
      z
        .object({
          page: z.string().optional().default("1"),
          limit: z.string().optional().default("20"),
        })
        .optional()
    ),
    async (c) => {
      const user = c.get("user")!;
      const query = c.req.valid("query");
      const page = query?.page || "1";
      const limit = query?.limit || "20";
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
      const skip = (pageNum - 1) * limitNum;

      const where = { buyerId: user.userId };

      const [orders, total] = await Promise.all([
        db.order.findMany({
          where,
          include: {
            subOrders: {
              include: {
                seller: {
                  select: {
                    storeName: true,
                    storeSlug: true,
                    logoUrl: true,
                  },
                },
                items: {
                  include: {
                    product: {
                      include: {
                        images: { take: 1, orderBy: { sortOrder: "asc" } },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        db.order.count({ where }),
      ]);

      return c.json({
        orders,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }
  )

  // 3. Seller's Sub-Orders (Paginated, Strictly Isolated by Seller Profile)
  .get(
    "/seller-orders",
    requireSeller,
    zValidator(
      "query",
      z
        .object({
          page: z.string().optional().default("1"),
          limit: z.string().optional().default("50"),
        })
        .optional()
    ),
    async (c) => {
      const user = c.get("user")!;
      const query = c.req.valid("query");
      const page = query?.page || "1";
      const limit = query?.limit || "50";
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      let sellerProfileId = user.sellerProfileId;
      if (!sellerProfileId) {
        const profile = await db.sellerProfile.findUnique({ where: { userId: user.userId } });
        if (!profile) return c.json({ error: "Seller profile not found" }, 404);
        sellerProfileId = profile.id;
      }

      const where = { sellerId: sellerProfileId };

      const [subOrders, total] = await Promise.all([
        db.subOrder.findMany({
          where,
          include: {
            order: {
              select: {
                id: true,
                createdAt: true,
                shippingAddress: true,
                buyer: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
            items: {
              include: {
                product: {
                  include: {
                    images: { take: 1, orderBy: { sortOrder: "asc" } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        db.subOrder.count({ where }),
      ]);

      return c.json({
        subOrders,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }
  )

  // 4. Update Sub-Order Fulfillment Status with State Machine (Seller Only)
  .patch(
    "/seller-orders/:id/status",
    requireSeller,
    zValidator(
      "json",
      z.object({
        status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
        trackingNumber: z.string().optional(),
        carrierName: z.string().optional(),
      })
    ),
    async (c) => {
      const user = c.get("user")!;
      const subOrderId = c.req.param("id");
      const { status, trackingNumber, carrierName } = c.req.valid("json");

      let sellerProfileId = user.sellerProfileId;
      if (!sellerProfileId) {
        const profile = await db.sellerProfile.findUnique({ where: { userId: user.userId } });
        if (!profile) return c.json({ error: "Seller profile not found" }, 404);
        sellerProfileId = profile.id;
      }

      // Check ownership
      const subOrder = await db.subOrder.findUnique({
        where: { id: subOrderId },
        include: { items: true },
      });

      if (!subOrder) {
        return c.json({ error: "Order not found" }, 404);
      }

      if (user.role !== "ADMIN" && subOrder.sellerId !== sellerProfileId) {
        return c.json({ error: "Forbidden: You cannot modify orders for another seller" }, 403);
      }

      // Order Status State Machine Validation
      const VALID_TRANSITIONS: Record<string, string[]> = {
        PROCESSING: ["SHIPPED", "CANCELLED"],
        SHIPPED: ["DELIVERED", "CANCELLED"],
        DELIVERED: [], // Terminal state
        CANCELLED: [], // Terminal state
        REFUNDED: [],  // Terminal state
      };

      if (subOrder.status !== status) {
        const allowedNext = VALID_TRANSITIONS[subOrder.status] || [];
        if (!allowedNext.includes(status)) {
          return c.json(
            {
              error: `Invalid status transition: Cannot transition order from "${subOrder.status}" to "${status}".`,
            },
            400
          );
        }
      }

      const isCancelling = status === "CANCELLED" && subOrder.status !== "CANCELLED";

      const updated = await db.$transaction(async (tx) => {
        // If transitioning to CANCELLED, restore product inventories and void payout record
        if (isCancelling) {
          for (const item of subOrder.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: {
                inventoryCount: { increment: item.quantity },
              },
            });
          }

          // Mark payout as FAILED so vendor won't receive payout for a cancelled order
          await tx.payoutRecord.updateMany({
            where: { subOrderId: subOrder.id },
            data: { status: "FAILED" },
          });

          // Check if all sibling sub-orders are also CANCELLED or REFUNDED
          const activeSiblingCount = await tx.subOrder.count({
            where: {
              orderId: subOrder.orderId,
              id: { not: subOrderId },
              status: { notIn: ["CANCELLED", "REFUNDED"] },
            },
          });

          if (activeSiblingCount === 0) {
            await tx.order.update({
              where: { id: subOrder.orderId },
              data: { paymentStatus: "CANCELLED" },
            });
          }
        }

        return await tx.subOrder.update({
          where: { id: subOrderId },
          data: {
            status,
            ...(trackingNumber ? { trackingNumber } : {}),
            ...(carrierName ? { carrierName } : {}),
          },
        });
      });

      return c.json({ success: true, subOrder: updated });
    }
  )

  // 5. Buyer Cancel Sub-Order (Buyer Only, allowed only when status is PROCESSING)
  .post("/cancel/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const subOrderId = c.req.param("id");

    const subOrder = await db.subOrder.findUnique({
      where: { id: subOrderId },
      include: {
        order: true,
        items: true,
      },
    });

    if (!subOrder) {
      return c.json({ error: "Sub-order not found" }, 404);
    }

    if (user.role !== "ADMIN" && subOrder.order.buyerId !== user.userId) {
      return c.json({ error: "Forbidden: You can only cancel your own orders" }, 403);
    }

    if (subOrder.status !== "PROCESSING") {
      return c.json(
        { error: `Cannot cancel shipment in "${subOrder.status}" state. Only "PROCESSING" orders can be cancelled.` },
        400
      );
    }

    await db.$transaction(async (tx) => {
      // 1. Restore product inventory
      for (const item of subOrder.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { inventoryCount: { increment: item.quantity } },
        });
      }

      // 2. Mark Sub-Order as CANCELLED
      await tx.subOrder.update({
        where: { id: subOrderId },
        data: { status: "CANCELLED" },
      });

      // 3. Mark Payout Record as FAILED
      await tx.payoutRecord.updateMany({
        where: { subOrderId: subOrderId },
        data: { status: "FAILED" },
      });

      // 4. Check if all sibling sub-orders are also CANCELLED
      const remainingActive = await tx.subOrder.count({
        where: {
          orderId: subOrder.orderId,
          status: { not: "CANCELLED" },
        },
      });

      if (remainingActive === 0) {
        await tx.order.update({
          where: { id: subOrder.orderId },
          data: { paymentStatus: "CANCELLED" },
        });
      }
    });

    return c.json({ success: true, message: "Order cancelled and inventory restored." });
  })

  // 6. Track Sub-Order by ID (Secured against IDOR and sensitive data leaks)
  .get("/track/:id", requireAuth, async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");

    const subOrder = await db.subOrder.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            buyerId: true,
          },
        },
        seller: {
          select: {
            id: true,
            storeName: true,
            storeSlug: true,
            logoUrl: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                images: { take: 1, orderBy: { sortOrder: "asc" } },
              },
            },
          },
        },
      },
    });

    if (!subOrder) {
      return c.json({ error: "Tracking information not found" }, 404);
    }

    // IDOR Protection: Verify caller is the buyer, the seller of this subOrder, or an admin
    const isBuyer = subOrder.order.buyerId === user.userId;
    const isSeller = user.role === "SELLER" && user.sellerProfileId === subOrder.sellerId;
    const isAdmin = user.role === "ADMIN";

    if (!isBuyer && !isSeller && !isAdmin) {
      return c.json(
        { error: "Forbidden: You are not authorized to view tracking for this order" },
        403
      );
    }

    // Sanitize response: Omit internal commission and seller payout for buyers
    const sanitizedSubOrder = {
      id: subOrder.id,
      orderId: subOrder.orderId,
      status: subOrder.status,
      trackingNumber: subOrder.trackingNumber,
      carrierName: subOrder.carrierName,
      subtotal: Number(subOrder.subtotal),
      createdAt: subOrder.createdAt,
      updatedAt: subOrder.updatedAt,
      seller: subOrder.seller,
      items: subOrder.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        product: item.product,
      })),
      ...(isAdmin || isSeller
        ? {
            commissionAmount: Number(subOrder.commissionAmount),
            sellerPayout: Number(subOrder.sellerPayout),
          }
        : {}),
    };

    return c.json({ subOrder: sanitizedSubOrder });
  });
