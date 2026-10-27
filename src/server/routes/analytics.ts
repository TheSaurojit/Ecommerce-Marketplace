import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionMiddleware, requireSeller, Env } from "../middleware/auth";

export const analyticsRoutes = new Hono<Env>()
  .use("*", sessionMiddleware, requireSeller)

  .get(
    "/seller",
    zValidator(
      "query",
      z
        .object({
          range: z.enum(["30d", "90d", "1y", "all"]).optional().default("30d"),
        })
        .optional()
    ),
    async (c) => {
      const user = c.get("user")!;
      const query = c.req.valid("query");
      const range = query?.range || "30d";

      let sellerProfileId = user.sellerProfileId;
      if (!sellerProfileId) {
        const profile = await db.sellerProfile.findUnique({ where: { userId: user.userId } });
        if (!profile) return c.json({ error: "Seller profile not found" }, 404);
        sellerProfileId = profile.id;
      }

      let startDate: Date | undefined;
      const now = Date.now();
      if (range === "30d") {
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      } else if (range === "90d") {
        startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
      } else if (range === "1y") {
        startDate = new Date(now - 365 * 24 * 60 * 60 * 1000);
      }

      const orderWhere = {
        sellerId: sellerProfileId,
        ...(startDate ? { createdAt: { gte: startDate } } : {}),
      };

      const [subOrders, payouts] = await Promise.all([
        db.subOrder.findMany({
          where: orderWhere,
          include: {
            items: { include: { product: true } },
            order: { select: { createdAt: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 500, // Safe upper query limit
        }),
        db.payoutRecord.findMany({
          where: { sellerId: sellerProfileId },
          include: {
            subOrder: {
              select: {
                id: true,
                orderId: true,
                status: true,
                createdAt: true,
                subtotal: true,
                commissionAmount: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 20, // Cap recent payouts ledger in analytics
        }),
      ]);

      const activeOrders = subOrders.filter(
        (o) => o.status !== "CANCELLED" && o.status !== "REFUNDED"
      );
      const totalOrders = activeOrders.length;
      const grossSales = activeOrders.reduce((acc, o) => acc + Number(o.subtotal), 0);
      const commissionPaid = activeOrders.reduce((acc, o) => acc + Number(o.commissionAmount), 0);
      const netEarnings = activeOrders.reduce((acc, o) => acc + Number(o.sellerPayout), 0);

    const pendingPayouts = payouts
      .filter((p) => p.status === "PENDING")
      .reduce((acc, p) => acc + Number(p.amount), 0);
    const completedPayouts = payouts
      .filter((p) => p.status === "TRANSFERRED")
      .reduce((acc, p) => acc + Number(p.amount), 0);

    // Group active sales by day/month for Recharts
    const salesByDateMap = new Map<string, { gross: number; net: number; orders: number }>();

    for (const order of activeOrders) {
      const dateKey = order.createdAt.toISOString().split("T")[0]; // YYYY-MM-DD
      const existing = salesByDateMap.get(dateKey) || { gross: 0, net: 0, orders: 0 };
      existing.gross += Number(order.subtotal);
      existing.net += Number(order.sellerPayout);
      existing.orders += 1;
      salesByDateMap.set(dateKey, existing);
    }

    const chartData = Array.from(salesByDateMap.entries()).map(([date, data]) => ({
      date,
      gross: Number(data.gross.toFixed(2)),
      net: Number(data.net.toFixed(2)),
      orders: data.orders,
    }));

    return c.json({
      summary: {
        totalOrders,
        grossSales: Number(grossSales.toFixed(2)),
        commissionPaid: Number(commissionPaid.toFixed(2)),
        netEarnings: Number(netEarnings.toFixed(2)),
        pendingPayouts: Number(pendingPayouts.toFixed(2)),
        completedPayouts: Number(completedPayouts.toFixed(2)),
      },
      payouts,
      chartData,
    });
  });
