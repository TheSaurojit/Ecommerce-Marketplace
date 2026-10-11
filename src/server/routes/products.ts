import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessionMiddleware, requireSeller, Env } from "../middleware/auth";
import { generateUniqueProductSlug } from "@/lib/slug";
import { ProductWhereInput, ProductOrderByWithRelationInput } from "@/generated/prisma/models";
import { formatZodErrorHook } from "../lib/validator";

export const productRoutes = new Hono<Env>()
  .use("*", sessionMiddleware)

  // 1. List / Search Products with Filtering
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        q: z.string().optional(),
        category: z.string().optional(),
        sellerId: z.string().optional(),
        storeSlug: z.string().optional(),
        status: z.enum(["PUBLISHED", "DRAFT", "PENDING_REVIEW", "OUT_OF_STOCK", "ARCHIVED", "ALL"]).optional(),
        minPrice: z.string().optional(),
        maxPrice: z.string().optional(),
        sort: z.enum(["newest", "price_asc", "price_desc", "featured"]).optional().default("newest"),
        page: z.string().optional().default("1"),
        limit: z.string().optional().default("12"),
      })
    ),
    async (c) => {
      const { q, category, sellerId, storeSlug, status, minPrice, maxPrice, sort, page, limit } =
        c.req.valid("query");

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));
      const skip = (pageNum - 1) * limitNum;

      const where: ProductWhereInput = {};

      // Security Guard: Determine if the requester is an authorized merchant or platform administrator
      const currentUser = c.get("user");
      const isAuthorizedOwnerOrAdmin =
        currentUser &&
        (currentUser.role === "ADMIN" || (sellerId && currentUser.sellerProfileId === sellerId));

      if (sellerId) {
        where.sellerId = sellerId;
      }

      // Restrict status visibility: Only authorized owners or admins can view non-published/all products
      if (isAuthorizedOwnerOrAdmin && status) {
        if (status === "ALL") {
          // By default, exclude soft-deleted/archived listings from the general list
          where.status = { not: "ARCHIVED" };
        } else {
          where.status = status;
        }
      } else {
        // Public / unauthorized visitors can ONLY ever see PUBLISHED listings
        where.status = "PUBLISHED";
      }

      if (q) {
        where.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ];
      }

      if (category) {
        where.category = {
          slug: category,
        };
      }

      if (storeSlug) {
        where.seller = {
          storeSlug: storeSlug,
        };
      }

      if (minPrice || maxPrice) {
        where.price = {};
        if (minPrice) where.price.gte = parseFloat(minPrice);
        if (maxPrice) where.price.lte = parseFloat(maxPrice);
      }

      let orderBy: ProductOrderByWithRelationInput | ProductOrderByWithRelationInput[] = { createdAt: "desc" };
      if (sort === "price_asc") orderBy = { price: "asc" };
      if (sort === "price_desc") orderBy = { price: "desc" };
      if (sort === "featured") orderBy = [{ featured: "desc" }, { createdAt: "desc" }];

      const [products, total] = await Promise.all([
        db.product.findMany({
          where,
          include: {
            images: { orderBy: { sortOrder: "asc" } },
            category: { select: { id: true, name: true, slug: true } },
            seller: {
              select: {
                id: true,
                storeName: true,
                storeSlug: true,
                logoUrl: true,
              },
            },
            reviews: { select: { rating: true } },
          },
          orderBy,
          skip,
          take: limitNum,
        }),
        db.product.count({ where }),
      ]);

      const formattedProducts = products.map((prod) => {
        const ratingCount = prod.reviews.length;
        const avgRating =
          ratingCount > 0
            ? Number(
              (prod.reviews.reduce((acc, r) => acc + r.rating, 0) / ratingCount).toFixed(1)
            )
            : 0;

        return {
          id: prod.id,
          title: prod.title,
          slug: prod.slug,
          description: prod.description,
          price: Number(prod.price),
          comparePrice: prod.comparePrice ? Number(prod.comparePrice) : null,
          inventoryCount: prod.inventoryCount,
          featured: prod.featured,
          category: prod.category,
          seller: prod.seller,
          images: prod.images,
          ratingCount,
          avgRating,
          createdAt: prod.createdAt,
        };
      });

      return c.json({
        products: formattedProducts,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }
  )

  // 2. Secure Seller Products Endpoint (Derived strictly from verified session, prevents sellerId manipulation)
  .get(
    "/seller-products",
    requireSeller,
    zValidator(
      "query",
      z.object({
        status: z.enum(["ALL_ACTIVE", "PUBLISHED", "DRAFT", "PENDING_REVIEW", "OUT_OF_STOCK", "ARCHIVED", "ALL"]).optional().default("ALL_ACTIVE"),
        q: z.string().optional(),
        page: z.string().optional().default("1"),
        limit: z.string().optional().default("100"),
      })
    ),
    async (c) => {
      const user = c.get("user")!;
      let sellerProfileId = user.sellerProfileId;

      if (!sellerProfileId) {
        const profile = await db.sellerProfile.findUnique({
          where: { userId: user.userId },
          select: { id: true },
        });
        if (!profile) return c.json({ error: "Seller profile not found" }, 404);
        sellerProfileId = profile.id;
      }

      const { status, q, page, limit } = c.req.valid("query");
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 100));
      const skip = (pageNum - 1) * limitNum;

      const where: ProductWhereInput = {
        sellerId: sellerProfileId,
      };

      // By default ("ALL_ACTIVE"), exclude ARCHIVED products so they don't clutter active listings
      if (status === "ALL_ACTIVE" || !status) {
        where.status = { not: "ARCHIVED" };
      } else if (status === "ARCHIVED") {
        where.status = "ARCHIVED";
      } else if (status !== "ALL") {
        where.status = status;
      }

      if (q) {
        where.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ];
      }

      const [products, total] = await Promise.all([
        db.product.findMany({
          where,
          include: {
            images: { orderBy: { sortOrder: "asc" } },
            category: { select: { id: true, name: true, slug: true } },
            seller: {
              select: {
                id: true,
                storeName: true,
                storeSlug: true,
                logoUrl: true,
              },
            },
            reviews: { select: { rating: true } },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limitNum,
        }),
        db.product.count({ where }),
      ]);

      const formattedProducts = products.map((prod) => {
        const ratingCount = prod.reviews.length;
        const avgRating =
          ratingCount > 0
            ? Number(
                (prod.reviews.reduce((acc, r) => acc + r.rating, 0) / ratingCount).toFixed(1)
              )
            : 0;

        return {
          id: prod.id,
          title: prod.title,
          slug: prod.slug,
          description: prod.description,
          price: Number(prod.price),
          comparePrice: prod.comparePrice ? Number(prod.comparePrice) : null,
          inventoryCount: prod.inventoryCount,
          status: prod.status,
          featured: prod.featured,
          category: prod.category,
          seller: prod.seller,
          images: prod.images,
          ratingCount,
          avgRating,
          createdAt: prod.createdAt,
        };
      });

      return c.json({
        products: formattedProducts,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }
  )

  // 3. Get Single Product by Slug
  .get("/slug/:slug", async (c) => {
    const slug = c.req.param("slug");

    const product = await db.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        category: true,
        seller: {
          select: {
            id: true,
            storeName: true,
            storeSlug: true,
            description: true,
            logoUrl: true,
            bannerUrl: true,
          },
        },
        reviews: {
          include: {
            buyer: { select: { id: true, name: true, image: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!product) {
      return c.json({ error: "Product not found" }, 404);
    }

    // Access control: DRAFT, PENDING_REVIEW, and ARCHIVED products are strictly private to the owner and admins
    const currentUser = c.get("user");
    const isOwnerOrAdmin =
      currentUser &&
      (currentUser.role === "ADMIN" || currentUser.sellerProfileId === product.seller.id);

    if (!isOwnerOrAdmin && product.status !== "PUBLISHED" && product.status !== "OUT_OF_STOCK") {
      return c.json({ error: "Product not found or is currently unavailable" }, 404);
    }

    const ratingCount = product.reviews.length;
    const avgRating =
      ratingCount > 0
        ? Number(
          (product.reviews.reduce((acc, r) => acc + r.rating, 0) / ratingCount).toFixed(1)
        )
        : 0;

    return c.json({
      product: {
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        price: Number(product.price),
        comparePrice: product.comparePrice ? Number(product.comparePrice) : null,
        inventoryCount: product.inventoryCount,
        status: product.status,
        featured: product.featured,
        category: product.category,
        seller: product.seller,
        images: product.images,
        reviews: product.reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          buyerName: r.buyer.name || "Verified Buyer",
        })),
        ratingCount,
        avgRating,
        createdAt: product.createdAt,
      },
    });
  })

  // 3. Create Product (Seller only)
  .post(
    "/",
    requireSeller,
    zValidator(
      "json",
      z.object({
        title: z
          .string({ message: "Product title is required" })
          .trim()
          .min(3, "Title must be at least 3 characters")
          .max(120, "Title cannot exceed 120 characters"),
        description: z
          .string({ message: "Product description is required" })
          .trim()
          .min(10, "Description must be at least 10 characters"),
        price: z
          .number({ message: "Price must be a valid number" })
          .positive("Price must be greater than 0"),
        comparePrice: z
          .number({ message: "Original price must be a valid number" })
          .positive("Original price must be greater than 0")
          .optional()
          .nullable(),
        inventoryCount: z
          .number({ message: "Inventory count must be a number" })
          .int("Inventory must be a whole number")
          .nonnegative("Inventory cannot be negative")
          .default(0),
        categoryId: z
          .string({ message: "Please select a category" })
          .min(1, "Please select a category"),
        images: z
          .array(z.string().url("Invalid image URL"), { message: "Product images are required" })
          .min(1, "At least one product image is required"),
        featured: z.boolean().optional().default(false),
        status: z
          .enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "OUT_OF_STOCK", "ARCHIVED"], {
            message: "Invalid product status",
          })
          .optional()
          .default("PUBLISHED"),
      }),
      formatZodErrorHook
    ),
    async (c) => {
      try {
        const user = c.get("user")!;
        const data = c.req.valid("json");

        // Verify seller profile exists
        let sellerProfileId = user.sellerProfileId;
        if (!sellerProfileId) {
          const profile = await db.sellerProfile.findUnique({ where: { userId: user.userId } });
          if (!profile) return c.json({ error: "Seller profile not found. Please apply for a merchant account first." }, 404);
          sellerProfileId = profile.id;
        }

        const uniqueSlug = await generateUniqueProductSlug(db, data.title);

        const newProduct = await db.product.create({
          data: {
            sellerId: sellerProfileId,
            categoryId: data.categoryId,
            title: data.title,
            slug: uniqueSlug,
            description: data.description,
            price: data.price,
            comparePrice: data.comparePrice ?? null,
            inventoryCount: data.inventoryCount,
            status: data.status,
            featured: data.featured,
            images: {
              create: data.images.map((url, idx) => ({
                url,
                sortOrder: idx,
                altText: `${data.title} image ${idx + 1}`,
              })),
            },
          },
          include: {
            images: true,
            category: true,
          },
        });

        return c.json({ success: true, product: newProduct }, 201);
      } catch (err: unknown) {
        console.error("Failed to create product:", err);
        return c.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "An unexpected error occurred while creating the product listing.",
          },
          500
        );
      }
    }
  )

  // 4. Update Product (Seller Owner or Admin)
  .patch(
    "/:id",
    requireSeller,
    zValidator(
      "json",
      z.object({
        title: z
          .string()
          .trim()
          .min(3, "Title must be at least 3 characters")
          .max(120, "Title cannot exceed 120 characters")
          .optional(),
        description: z
          .string()
          .trim()
          .min(10, "Description must be at least 10 characters")
          .optional(),
        price: z
          .number({ message: "Price must be a valid number" })
          .positive("Price must be greater than 0")
          .optional(),
        comparePrice: z
          .number({ message: "Original price must be a valid number" })
          .positive("Original price must be greater than 0")
          .optional()
          .nullable(),
        inventoryCount: z
          .number({ message: "Inventory count must be a number" })
          .int("Inventory must be a whole number")
          .nonnegative("Inventory cannot be negative")
          .optional(),
        categoryId: z
          .string()
          .min(1, "Please select a valid category")
          .optional(),
        status: z
          .enum(["DRAFT", "PENDING_REVIEW", "PUBLISHED", "OUT_OF_STOCK", "ARCHIVED"], {
            message: "Invalid product status",
          })
          .optional(),
        images: z
          .array(z.string().url("Invalid image URL"))
          .optional(),
        featured: z.boolean().optional(),
      }),
      formatZodErrorHook
    ),
    async (c) => {
      const user = c.get("user")!;
      const id = c.req.param("id");
      const data = c.req.valid("json");

      const existing = await db.product.findUnique({
        where: { id },
        include: { seller: true },
      });

      if (!existing) {
        return c.json({ error: "Product not found" }, 404);
      }

      // Authorization guard: must be store owner or admin
      if (user.role !== "ADMIN" && existing.seller.userId !== user.userId) {
        return c.json({ error: "Forbidden: You can only edit your own products" }, 403);
      }

      // Atomic Transaction: Ensure image replacement and details update succeed or fail together
      const updated = await db.$transaction(async (tx) => {
        if (data.images) {
          await tx.productImage.deleteMany({ where: { productId: id } });
          await tx.productImage.createMany({
            data: data.images.map((url, idx) => ({
              productId: id,
              url,
              sortOrder: idx,
              altText: `${data.title || existing.title} image ${idx + 1}`,
            })),
          });
        }

        return await tx.product.update({
          where: { id },
          data: {
            ...(data.title ? { title: data.title } : {}),
            ...(data.description ? { description: data.description } : {}),
            ...(data.price !== undefined ? { price: data.price } : {}),
            ...(data.comparePrice !== undefined ? { comparePrice: data.comparePrice } : {}),
            ...(data.inventoryCount !== undefined ? { inventoryCount: data.inventoryCount } : {}),
            ...(data.categoryId ? { categoryId: data.categoryId } : {}),
            ...(data.status ? { status: data.status } : {}),
            ...(data.featured !== undefined ? { featured: data.featured } : {}),
          },
          include: {
            images: { orderBy: { sortOrder: "asc" } },
            category: true,
          },
        });
      });

      return c.json({ success: true, product: updated });
    }
  )

  // 5. Delete Product
  .delete("/:id", requireSeller, async (c) => {
    const user = c.get("user")!;
    const id = c.req.param("id");

    const existing = await db.product.findUnique({
      where: { id },
      include: { seller: true },
    });

    if (!existing) {
      return c.json({ error: "Product not found" }, 404);
    }

    if (user.role !== "ADMIN" && existing.seller.userId !== user.userId) {
      return c.json({ error: "Forbidden: You can only delete your own products" }, 403);
    }

    // Check if product has past orders to prevent foreign key constraint violations
    const orderCount = await db.orderItem.count({ where: { productId: id } });

    if (orderCount > 0) {
      // Soft-delete: archive product to preserve historical invoices and receipts
      await db.product.update({
        where: { id },
        data: { status: "ARCHIVED" },
      });
      return c.json({
        success: true,
        message: "Product has past purchase history and was archived to maintain order records.",
        archived: true,
      });
    }

    // Safe to hard-delete if it has no sales history
    await db.productImage.deleteMany({ where: { productId: id } });
    await db.product.delete({ where: { id } });
    return c.json({ success: true, message: "Product deleted successfully" });
  });
