import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionMiddleware, requireAuth, Env } from "../middleware/auth";

export const reviewRoutes = new Hono<Env>()
  .use("*", sessionMiddleware)

  .post(
    "/",
    requireAuth,
    zValidator(
      "json",
      z.object({
        productId: z.string(),
        rating: z.number().int().min(1).max(5),
        comment: z.string().min(3),
      })
    ),
    async (c) => {
      const user = c.get("user")!;
      const { productId, rating, comment } = c.req.valid("json");

      // Verify product exists
      const product = await db.product.findUnique({ where: { id: productId } });
      if (!product) {
        return c.json({ error: "Product not found" }, 404);
      }

      // Enforce Verified Purchase: User must have purchased this product in a paid order
      if (user.role !== "ADMIN") {
        const verifiedPurchase = await db.orderItem.findFirst({
          where: {
            productId,
            subOrder: {
              order: {
                buyerId: user.userId,
                paymentStatus: "PAID",
              },
            },
          },
        });

        if (!verifiedPurchase) {
          return c.json(
            {
              error: "Verified Purchase Required: Only buyers who have purchased this product can leave a review.",
            },
            403
          );
        }
      }

      // Check if user has already reviewed
      const existing = await db.review.findUnique({
        where: {
          productId_buyerId: {
            productId,
            buyerId: user.userId,
          },
        },
      });

      if (existing) {
        const updated = await db.review.update({
          where: { id: existing.id },
          data: { rating, comment },
        });
        return c.json({ success: true, review: updated, updated: true });
      }

      const review = await db.review.create({
        data: {
          productId,
          buyerId: user.userId,
          rating,
          comment,
        },
      });

      return c.json({ success: true, review }, 201);
    }
  )

  .get("/product/:productId", async (c) => {
    const productId = c.req.param("productId");

    const reviews = await db.review.findMany({
      where: { productId },
      include: {
        buyer: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json({ reviews });
  });
