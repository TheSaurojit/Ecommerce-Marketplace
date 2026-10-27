import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { COOKIE_NAME, verifySession, SessionPayload } from "../auth";
import { db } from "@/lib/db";

export type Env = {
  Variables: {
    user: SessionPayload | null;
  };
};

export const sessionMiddleware = createMiddleware<Env>(async (c, next) => {
  const cookieToken = getCookie(c, COOKIE_NAME);
  const authHeader = c.req.header("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
  const token = cookieToken || bearerToken;

  if (token) {
    const session = await verifySession(token);
    if (session) {
      // Query database to ensure fresh role and storeStatus (prevents stale/frozen JWT permissions)
      const dbUser = await db.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          email: true,
          role: true,
          sellerProfile: {
            select: {
              id: true,
              status: true,
              storeName: true,
            },
          },
        },
      });

      if (dbUser) {
        c.set("user", {
          userId: dbUser.id,
          email: dbUser.email,
          role: dbUser.role as "BUYER" | "SELLER" | "ADMIN",
          sellerProfileId: dbUser.sellerProfile?.id,
          storeName: dbUser.sellerProfile?.storeName,
          storeStatus: dbUser.sellerProfile?.status,
        });
      } else {
        c.set("user", null);
      }
    } else {
      c.set("user", null);
    }
  } else {
    c.set("user", null);
  }

  await next();
});

export const requireAuth = createMiddleware<Env>(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized. Please sign in." }, 401);
  }
  await next();
});

export const requireSeller = createMiddleware<Env>(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized. Please sign in." }, 401);
  }
  if (user.role !== "SELLER" && user.role !== "ADMIN") {
    return c.json({ error: "Forbidden. Seller access required." }, 403);
  }

  // Validate live store status from the database to prevent stale JWT session bypass
  if (user.role === "SELLER") {
    const profile = await db.sellerProfile.findUnique({
      where: { userId: user.userId },
      select: { id: true, status: true, storeName: true },
    });

    if (!profile) {
      return c.json({ error: "No merchant profile associated with this account." }, 403);
    }

    if (profile.status !== "APPROVED") {
      const message =
        profile.status === "SUSPENDED"
          ? "Your merchant store is currently suspended by platform administration."
          : profile.status === "REJECTED"
          ? "Your merchant application was rejected."
          : "Your merchant store is currently pending administrator approval.";

      return c.json({ error: message, storeStatus: profile.status }, 403);
    }

    // Keep memory context up to date with live profile id
    user.sellerProfileId = profile.id;
    user.storeName = profile.storeName;
    user.storeStatus = profile.status;
  }

  await next();
});

export const requireAdmin = createMiddleware<Env>(async (c, next) => {
  const user = c.get("user");
  if (!user || user.role !== "ADMIN") {
    return c.json({ error: "Forbidden. Admin access required." }, 403);
  }
  await next();
});
