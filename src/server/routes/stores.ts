import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionMiddleware, requireAuth, Env } from "../middleware/auth";
import { generateUniqueStoreSlug } from "@/lib/slug";

export const storeRoutes = new Hono<Env>()
  .use("*", sessionMiddleware)

  // 1. List Approved Stores
  .get("/", async (c) => {
    const stores = await db.sellerProfile.findMany({
      where: { status: "APPROVED" },
      select: {
        id: true,
        storeName: true,
        storeSlug: true,
        description: true,
        logoUrl: true,
        bannerUrl: true,
        createdAt: true,
        _count: {
          select: { products: { where: { status: "PUBLISHED" } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return c.json({ stores });
  })

  // 2. Get Public Store Page
  .get("/slug/:slug", async (c) => {
    const slug = c.req.param("slug");

    const store = await db.sellerProfile.findUnique({
      where: { storeSlug: slug },
      include: {
        products: {
          where: { status: "PUBLISHED" },
          include: {
            images: { orderBy: { sortOrder: "asc" } },
            category: true,
            reviews: { select: { rating: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!store || store.status !== "APPROVED") {
      return c.json({ error: "Store not found or is currently unavailable" }, 404);
    }

    const formattedProducts = store.products.map((p) => {
      const ratingCount = p.reviews.length;
      const avgRating =
        ratingCount > 0
          ? Number((p.reviews.reduce((acc, r) => acc + r.rating, 0) / ratingCount).toFixed(1))
          : 0;

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        description: p.description,
        price: Number(p.price),
        comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
        inventoryCount: p.inventoryCount,
        category: p.category,
        images: p.images,
        ratingCount,
        avgRating,
      };
    });

    return c.json({
      store: {
        id: store.id,
        storeName: store.storeName,
        storeSlug: store.storeSlug,
        description: store.description,
        logoUrl: store.logoUrl,
        bannerUrl: store.bannerUrl,
        status: store.status,
        createdAt: store.createdAt,
        products: formattedProducts,
      },
    });
  })

  // 3. Current User's Store Info
  .get("/my-store", requireAuth, async (c) => {
    const user = c.get("user")!;

    const store = await db.sellerProfile.findUnique({
      where: { userId: user.userId },
      include: {
        products: {
          include: {
            images: { orderBy: { sortOrder: "asc" } },
            category: true,
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: { subOrders: true },
        },
      },
    });

    if (!store) {
      return c.json({ store: null });
    }

    return c.json({ store });
  })

  // 4. Apply to become a seller
  .post(
    "/apply",
    requireAuth,
    zValidator(
      "json",
      z.object({
        storeName: z.string().min(2),
        description: z.string().min(10),
        logoUrl: z.string().url().optional().or(z.literal("")).transform((val) => val || undefined),
        bannerUrl: z.string().url().optional().or(z.literal("")).transform((val) => val || undefined),
      })
    ),
    async (c) => {
      const user = c.get("user")!;
      const data = c.req.valid("json");

      const existingProfile = await db.sellerProfile.findUnique({
        where: { userId: user.userId },
      });

      if (existingProfile) {
        return c.json({ error: "You have already applied or registered a store" }, 400);
      }

      const trimmedStoreName = data.storeName.trim();
      const existingName = await db.sellerProfile.findUnique({
        where: { storeName: trimmedStoreName },
      });

      if (existingName) {
        return c.json({ error: `A store named "${trimmedStoreName}" already exists. Please choose a unique store name.` }, 400);
      }

      const storeSlug = await generateUniqueStoreSlug(db, trimmedStoreName);

      try {
        const store = await db.sellerProfile.create({
          data: {
            userId: user.userId,
            storeName: trimmedStoreName,
            storeSlug,
            description: data.description,
            logoUrl: data.logoUrl,
            bannerUrl: data.bannerUrl,
            status: "PENDING_APPROVAL",
          },
        });

        return c.json({ success: true, store }, 201);
      } catch (err: unknown) {
        const errorCode =
          typeof err === "object" && err !== null && "code" in err ? err.code : undefined;
        if (errorCode === "P2002") {
          return c.json(
            { error: "A store with this name or URL slug already exists. Please choose another store name." },
            400
          );
        }
        return c.json({ error: "Failed to submit merchant application." }, 500);
      }
    }
  )

  // 5. Update My Store Profile
  .put(
    "/my-store",
    requireAuth,
    zValidator(
      "json",
      z.object({
        storeName: z.string().min(2).optional(),
        description: z.string().min(10).optional(),
        logoUrl: z.string().url().optional().nullable(),
        bannerUrl: z.string().url().optional().nullable(),
      })
    ),
    async (c) => {
      const user = c.get("user")!;
      const data = c.req.valid("json");

      const store = await db.sellerProfile.findUnique({
        where: { userId: user.userId },
      });

      if (!store) {
        return c.json({ error: "Store not found" }, 404);
      }

      try {
        const updated = await db.sellerProfile.update({
          where: { id: store.id },
          data: {
            ...(data.storeName ? { storeName: data.storeName.trim() } : {}),
            ...(data.description ? { description: data.description } : {}),
            ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
            ...(data.bannerUrl !== undefined ? { bannerUrl: data.bannerUrl } : {}),
          },
        });

        return c.json({ success: true, store: updated });
      } catch (err: unknown) {
        const errorCode =
          typeof err === "object" && err !== null && "code" in err ? err.code : undefined;
        if (errorCode === "P2002") {
          return c.json(
            { error: "A store with this name already exists. Please choose another name." },
            400
          );
        }
        return c.json({ error: "Failed to update store profile." }, 500);
      }
    }
  );
