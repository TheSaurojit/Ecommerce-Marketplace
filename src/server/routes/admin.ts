import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionMiddleware, requireAdmin, Env } from "../middleware/auth";
import { SellerProfileWhereInput, PayoutRecordWhereInput } from "@/generated/prisma/models";
import { stripe, isStripeConfigured } from "@/lib/stripe";

export const adminRoutes = new Hono<Env>()
  .use("*", sessionMiddleware, requireAdmin)

  // 1. Platform Overview Metrics
  .get("/metrics", async (c) => {
    const [totalSellers, totalProducts, totalOrders, subOrders] = await Promise.all([
      db.sellerProfile.count(),
      db.product.count(),
      db.order.count(),
      db.subOrder.findMany({
        where: {
          status: { notIn: ["CANCELLED", "REFUNDED"] },
        },
        select: {
          subtotal: true,
          commissionAmount: true,
          sellerPayout: true,
        },
      }),
    ]);

    const gmv = subOrders.reduce((sum, o) => sum + Number(o.subtotal), 0);
    const platformRevenue = subOrders.reduce((sum, o) => sum + Number(o.commissionAmount), 0);
    const pendingSellersCount = await db.sellerProfile.count({
      where: { status: "PENDING_APPROVAL" },
    });

    return c.json({
      metrics: {
        totalSellers,
        pendingSellersCount,
        totalProducts,
        totalOrders,
        gmv: Number(gmv.toFixed(2)),
        platformRevenue: Number(platformRevenue.toFixed(2)),
      },
    });
  })

  // 2. List Sellers with status filtering (Paginated)
  .get(
    "/sellers",
    zValidator(
      "query",
      z
        .object({
          status: z.enum(["ALL", "PENDING_APPROVAL", "APPROVED", "SUSPENDED", "REJECTED"]).optional().default("ALL"),
          page: z.string().optional().default("1"),
          limit: z.string().optional().default("50"),
        })
        .optional()
    ),
    async (c) => {
      const query = c.req.valid("query");
      const status = query?.status || "ALL";
      const page = query?.page || "1";
      const limit = query?.limit || "50";
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      const where: SellerProfileWhereInput = {};
      if (status !== "ALL") {
        where.status = status;
      }

      const [sellers, total] = await Promise.all([
        db.sellerProfile.findMany({
          where,
          include: {
            user: { select: { id: true, name: true, email: true } },
            _count: {
              select: { products: true, subOrders: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        db.sellerProfile.count({ where }),
      ]);

      return c.json({
        sellers,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }
  )

  // 3. Moderate Seller Application
  .patch(
    "/sellers/:id/status",
    zValidator(
      "json",
      z.object({
        status: z.enum(["APPROVED", "REJECTED", "SUSPENDED", "PENDING_APPROVAL"]),
        commissionRate: z.number().min(0).max(1).optional(),
      })
    ),
    async (c) => {
      const id = c.req.param("id");
      const { status, commissionRate } = c.req.valid("json");

      const seller = await db.sellerProfile.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!seller) {
        return c.json({ error: "Seller profile not found" }, 404);
      }

      const updated = await db.sellerProfile.update({
        where: { id },
        data: {
          status,
          ...(commissionRate !== undefined ? { commissionRate } : {}),
        },
      });

      // If approved, update user's role to SELLER
      if (status === "APPROVED" && seller.user.role !== "SELLER") {
        await db.user.update({
          where: { id: seller.userId },
          data: { role: "SELLER" },
        });
      }

      return c.json({ success: true, seller: updated });
    }
  )

  // 4. Products Moderation List (Paginated)
  .get(
    "/products",
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
      const query = c.req.valid("query");
      const page = query?.page || "1";
      const limit = query?.limit || "50";
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      const [products, total] = await Promise.all([
        db.product.findMany({
          include: {
            seller: { select: { id: true, storeName: true, storeSlug: true } },
            category: { select: { id: true, name: true } },
            images: { take: 1 },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        db.product.count(),
      ]);

      return c.json({
        products,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }
  )

  // 5. Moderate Product Status
  .patch(
    "/products/:id/status",
    zValidator(
      "json",
      z.object({
        status: z.enum(["PUBLISHED", "ARCHIVED", "PENDING_REVIEW"]),
      })
    ),
    async (c) => {
      const id = c.req.param("id");
      const { status } = c.req.valid("json");

      const product = await db.product.update({
        where: { id },
        data: { status },
      });

      return c.json({ success: true, product });
    }
  )

  // 6. Global Payout Ledger Management (Paginated with DB Aggregations)
  .get(
    "/payouts",
    zValidator(
      "query",
      z
        .object({
          status: z.enum(["ALL", "PENDING", "TRANSFERRED", "FAILED"]).optional().default("ALL"),
          page: z.string().optional().default("1"),
          limit: z.string().optional().default("50"),
        })
        .optional()
    ),
    async (c) => {
      const query = c.req.valid("query");
      const status = query?.status || "ALL";
      const page = query?.page || "1";
      const limit = query?.limit || "50";
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      const where: PayoutRecordWhereInput = {};
      if (status !== "ALL") {
        where.status = status;
      }

      const [payouts, total, pendingAgg, transferredAgg] = await Promise.all([
        db.payoutRecord.findMany({
          where,
          include: {
            seller: {
              select: {
                id: true,
                storeName: true,
                storeSlug: true,
                user: { select: { name: true, email: true } },
              },
            },
            subOrder: {
              select: {
                id: true,
                orderId: true,
                subtotal: true,
                commissionAmount: true,
                sellerPayout: true,
                status: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        db.payoutRecord.count({ where }),
        db.payoutRecord.aggregate({
          _sum: { amount: true },
          where: { status: "PENDING" },
        }),
        db.payoutRecord.aggregate({
          _sum: { amount: true },
          where: { status: "TRANSFERRED" },
        }),
      ]);

      const pendingTotal = Number(pendingAgg._sum.amount || 0);
      const transferredTotal = Number(transferredAgg._sum.amount || 0);

      return c.json({
        payouts,
        summary: {
          pendingTotal: Number(pendingTotal.toFixed(2)),
          transferredTotal: Number(transferredTotal.toFixed(2)),
          totalRecords: total,
        },
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }
  )

  // 7. Disburse / Update Payout Record Status
  .patch(
    "/payouts/:id/status",
    zValidator(
      "json",
      z.object({
        status: z.enum(["PENDING", "TRANSFERRED", "FAILED"]),
        stripeTransferId: z.string().optional(),
      })
    ),
    async (c) => {
      const id = c.req.param("id");
      const { status, stripeTransferId } = c.req.valid("json");

      const existing = await db.payoutRecord.findUnique({
        where: { id },
        include: { seller: true },
      });

      if (!existing) {
        return c.json({ error: "Payout record not found" }, 404);
      }

      let transferId = stripeTransferId;

      // When transitioning to TRANSFERRED: execute real Stripe transfer if Connect account exists
      if (status === "TRANSFERRED" && !transferId) {
        if (
          isStripeConfigured() &&
          stripe &&
          existing.seller.stripeAccountId &&
          existing.seller.payoutsEnabled
        ) {
          try {
            const transfer = await stripe.transfers.create({
              amount: Math.round(Number(existing.amount) * 100),
              currency: "inr",
              destination: existing.seller.stripeAccountId,
              description: `Payout for SubOrder ${existing.subOrderId}`,
              transfer_group: existing.subOrderId,
            });
            transferId = transfer.id;
          } catch (stripeErr: unknown) {
            console.error("[Stripe Connect Transfer Error]:", stripeErr);
            return c.json(
              {
                error: `Stripe transfer execution failed: ${
                  stripeErr instanceof Error ? stripeErr.message : "Unknown error"
                }`,
              },
              400
            );
          }
        } else {
          // Authoritative server-side ledger reference for manual/offline bank transfers
          transferId = `manual_disb_${existing.id}_${Date.now().toString(36)}`;
        }
      }

      const updated = await db.payoutRecord.update({
        where: { id },
        data: {
          status,
          ...(transferId ? { stripeTransferId: transferId } : {}),
        },
      });

      return c.json({ success: true, payout: updated });
    }
  )

  // 8. Global Orders Oversight (Paginated)
  .get(
    "/orders",
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
      const query = c.req.valid("query");
      const page = query?.page || "1";
      const limit = query?.limit || "50";
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      const [orders, total] = await Promise.all([
        db.order.findMany({
          include: {
            buyer: { select: { id: true, name: true, email: true } },
            subOrders: {
              include: {
                seller: { select: { id: true, storeName: true, storeSlug: true, logoUrl: true } },
                items: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        title: true,
                        slug: true,
                        images: { select: { url: true }, take: 1, orderBy: { sortOrder: "asc" } },
                      },
                    },
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        db.order.count(),
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
  );
