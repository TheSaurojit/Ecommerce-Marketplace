import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { setCookie, deleteCookie } from "hono/cookie";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, signSession, COOKIE_NAME, SessionPayload } from "../auth";
import { sessionMiddleware, Env } from "../middleware/auth";
import { generateUniqueStoreSlug } from "@/lib/slug";

export const authRoutes = new Hono<Env>()
  .use("*", sessionMiddleware)

  .post(
    "/register",
    zValidator(
      "json",
      z.object({
        name: z.string().min(2, "Name must be at least 2 characters"),
        email: z.string().email("Invalid email address"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        role: z.enum(["BUYER", "SELLER"]).default("BUYER"),
        storeName: z.string().optional(),
        storeDescription: z.string().optional(),
      })
    ),
    async (c) => {
      const { name, email, password, role, storeName, storeDescription } = c.req.valid("json");

      const existingUser = await db.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return c.json({ error: "An account with this email already exists" }, 400);
      }

      let uniqueStoreSlug: string | undefined;

      if (role === "SELLER") {
        if (!storeName || storeName.trim().length < 2) {
          return c.json({ error: "Store name is required for seller registration" }, 400);
        }

        const trimmedStoreName = storeName.trim();
        const existingStore = await db.sellerProfile.findUnique({
          where: { storeName: trimmedStoreName },
        });

        if (existingStore) {
          return c.json({ error: `Store name "${trimmedStoreName}" is already taken. Please choose another name.` }, 400);
        }

        uniqueStoreSlug = await generateUniqueStoreSlug(db, trimmedStoreName);
      }

      const passwordHash = await hashPassword(password);

      try {
        const user = await db.user.create({
          data: {
            name,
            email,
            passwordHash,
            role,
            ...(role === "SELLER" && storeName && uniqueStoreSlug
              ? {
                  sellerProfile: {
                    create: {
                      storeName: storeName.trim(),
                      storeSlug: uniqueStoreSlug,
                      description: storeDescription || null,
                      status: "PENDING_APPROVAL",
                    },
                  },
                }
              : {}),
          },
          include: { sellerProfile: true },
        });

        const sessionPayload: SessionPayload = {
          userId: user.id,
          email: user.email,
          role: user.role as "BUYER" | "SELLER" | "ADMIN",
          sellerProfileId: user.sellerProfile?.id,
          storeName: user.sellerProfile?.storeName,
          storeStatus: user.sellerProfile?.status,
        };

        const token = await signSession(sessionPayload);

        setCookie(c, COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Lax",
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: "/",
        });

        return c.json({
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            sellerProfile: user.sellerProfile,
          },
        });
      } catch (err: unknown) {
        const errorRecord =
          typeof err === "object" && err !== null
            ? (err as Record<string, unknown>)
            : null;
        if (errorRecord?.code === "P2002") {
          const meta =
            typeof errorRecord.meta === "object" && errorRecord.meta !== null
              ? (errorRecord.meta as Record<string, unknown>)
              : null;
          const target = Array.isArray(meta?.target)
            ? meta.target.join(", ")
            : String(meta?.target || "");
          if (target.includes("storeSlug") || target.includes("storeName")) {
            return c.json(
              { error: "A store with this name or URL slug already exists. Please choose another store name." },
              400
            );
          }
          if (target.includes("email")) {
            return c.json({ error: "An account with this email already exists" }, 400);
          }
          return c.json(
            { error: "A unique account or store conflict occurred. Please review your details." },
            400
          );
        }

        console.error("Registration error:", err);
        return c.json({ error: "Failed to create account. Please try again." }, 500);
      }
    }
  )

  .post(
    "/login",
    zValidator(
      "json",
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    ),
    async (c) => {
      const { email, password } = c.req.valid("json");

      const user = await db.user.findUnique({
        where: { email },
        include: { sellerProfile: true },
      });

      if (!user || !user.passwordHash) {
        return c.json({ error: "Invalid email or password" }, 401);
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return c.json({ error: "Invalid email or password" }, 401);
      }

      const sessionPayload: SessionPayload = {
        userId: user.id,
        email: user.email,
        role: user.role as "BUYER" | "SELLER" | "ADMIN",
        sellerProfileId: user.sellerProfile?.id,
        storeName: user.sellerProfile?.storeName,
        storeStatus: user.sellerProfile?.status,
      };

      const token = await signSession(sessionPayload);

      setCookie(c, COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      return c.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          sellerProfile: user.sellerProfile,
        },
      });
    }
  )

  .post("/logout", async (c) => {
    deleteCookie(c, COOKIE_NAME, { path: "/" });
    return c.json({ success: true, message: "Logged out successfully" });
  })

  .get("/me", async (c) => {

    const session = c.get("user");
    if (!session) {
      return c.json({ user: null });
    }

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        sellerProfile: {
          select: {
            id: true,
            storeName: true,
            storeSlug: true,
            status: true,
            logoUrl: true,
            bannerUrl: true,
            commissionRate: true,
          },
        },
      },
    });

    if (user) {
      // Re-synchronize session cookie if database role or store status has changed
      const currentRole = user.role as "BUYER" | "SELLER" | "ADMIN";
      const currentStoreStatus = user.sellerProfile?.status;
      const currentStoreName = user.sellerProfile?.storeName;
      const currentProfileId = user.sellerProfile?.id;

      if (
        session.role !== currentRole ||
        session.storeStatus !== currentStoreStatus ||
        session.sellerProfileId !== currentProfileId
      ) {
        const refreshedPayload: SessionPayload = {
          userId: user.id,
          email: user.email,
          role: currentRole,
          sellerProfileId: currentProfileId,
          storeName: currentStoreName,
          storeStatus: currentStoreStatus,
        };
        const refreshedToken = await signSession(refreshedPayload);
        setCookie(c, COOKIE_NAME, refreshedToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "Lax",
          maxAge: 60 * 60 * 24 * 7,
          path: "/",
        });
      }
    }

    return c.json({ user });
  });
