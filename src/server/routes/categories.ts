import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionMiddleware, requireAdmin, Env } from "../middleware/auth";

export const categoryRoutes = new Hono<Env>()
  .use("*", sessionMiddleware)

  .get("/", async (c) => {
    const categories = await db.category.findMany({
      include: {
        _count: {
          select: { products: { where: { status: "PUBLISHED" } } },
        },
      },
      orderBy: { name: "asc" },
    });

    return c.json({ categories });
  })

  .post(
    "/",
    requireAdmin,
    zValidator(
      "json",
      z.object({
        name: z.string().min(2),
        description: z.string().optional(),
        imageUrl: z.string().url().optional(),
      })
    ),
    async (c) => {
      const { name, description, imageUrl } = c.req.valid("json");
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const category = await db.category.create({
        data: { name, slug, description, imageUrl },
      });

      return c.json({ success: true, category }, 201);
    }
  );
