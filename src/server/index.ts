import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth";
import { productRoutes } from "./routes/products";
import { storeRoutes } from "./routes/stores";
import { categoryRoutes } from "./routes/categories";
import { orderRoutes } from "./routes/orders";
import { reviewRoutes } from "./routes/reviews";
import { adminRoutes } from "./routes/admin";
import { analyticsRoutes } from "./routes/analytics";
import { uploadRoutes } from "./routes/upload";
import { ZodError } from "zod";

const app = new Hono().basePath("/api");

// Global middlewares
app.use("*", logger());

const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.APP_URL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : []),
]
  .filter(Boolean)
  .map((o) => (o as string).trim().replace(/\/$/, ""));

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null;
      const normalized = origin.trim().replace(/\/$/, "");
      if (allowedOrigins.includes(normalized)) {
        return origin;
      }
      return null;
    },
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => {
  return c.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Mount modular sub-routers
export const routes = app
  .route("/auth", authRoutes)
  .route("/products", productRoutes)
  .route("/stores", storeRoutes)
  .route("/categories", categoryRoutes)
  .route("/orders", orderRoutes)
  .route("/reviews", reviewRoutes)
  .route("/admin", adminRoutes)
  .route("/analytics", analyticsRoutes)
  .route("/upload", uploadRoutes);

// Global Error Handler (Sanitizes stack traces and database internals)
app.onError((err, c) => {
  console.error(`[API Error] ${c.req.method} ${c.req.url}:`, err);

  // Handle Prisma Known Request Errors
  const prismaCode =
    "code" in err && typeof err.code === "string" ? err.code : undefined;
  if (prismaCode === "P2002") {
    return c.json(
      { error: "A unique constraint was violated. A record with this value already exists." },
      400
    );
  }
  if (prismaCode === "P2025") {
    return c.json({ error: "The requested record was not found." }, 404);
  }
  if (typeof prismaCode === "string" && prismaCode.startsWith("P")) {
    return c.json({ error: "A database error occurred while processing your request." }, 400);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const issues = err.issues;
    const firstIssue = issues[0];
    const message = firstIssue?.message || "Invalid request payload";
    return c.json(
      {
        success: false,
        error: message,
        message,
        errors: issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      400
    );
  }

  const isDev = process.env.NODE_ENV === "development";
  return c.json(
    {
      error: isDev ? err.message : "Internal Server Error",
      ...(isDev && err.stack ? { stack: err.stack } : {}),
    },
    500
  );
});

// Global 404 Not Found Handler
app.notFound((c) => {
  return c.json({ error: "Endpoint not found" }, 404);
});

export { app };
export type AppType = typeof routes;
