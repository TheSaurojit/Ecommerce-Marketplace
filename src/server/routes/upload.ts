import { Hono } from "hono";
import { sessionMiddleware, requireAuth, Env } from "../middleware/auth";
import { uploadToSupabaseStorage, isSupabaseConfigured, BUCKET_NAME } from "@/lib/supabase";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const uploadRoutes = new Hono<Env>()
  .use("*", sessionMiddleware)

  // Check upload service configuration status
  .get("/status", async (c) => {
    return c.json({
      configured: isSupabaseConfigured(),
      bucket: BUCKET_NAME,
      maxSizeBytes: MAX_FILE_SIZE,
      allowedTypes: ALLOWED_MIME_TYPES,
    });
  })

  // Upload an image file (multipart/form-data)
  .post("/", requireAuth, async (c) => {
    try {
      const body = await c.req.parseBody();
      const file = body["file"];

      if (!file || typeof file === "string") {
        return c.json({ error: "No file was uploaded or invalid file format" }, 400);
      }

      // Check if file is a File/Blob instance
      if (!(file instanceof File)) {
        return c.json({ error: "Uploaded payload is not a valid file" }, 400);
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return c.json(
          {
            error: `Unsupported file type: ${file.type}. Allowed formats: JPG, PNG, WEBP, GIF, SVG`,
          },
          400
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return c.json(
          {
            error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed is 10MB.`,
          },
          400
        );
      }

      const folder = typeof body["folder"] === "string" ? body["folder"] : "products";
      const arrayBuffer = await file.arrayBuffer();

      const uploadResult = await uploadToSupabaseStorage({
        fileBuffer: arrayBuffer,
        fileName: file.name,
        contentType: file.type,
        folder,
      });

      return c.json({
        success: true,
        url: uploadResult.url,
        path: uploadResult.path,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
      });
    } catch (err: unknown) {
      console.error("[Upload Handler Error]:", err);
      return c.json(
        {
          error:
            err instanceof Error ? err.message : "Failed to process image upload",
        },
        500
      );
    }
  });
