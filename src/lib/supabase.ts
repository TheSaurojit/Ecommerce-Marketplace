
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabasePublicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

// Server-side only. Never expose this key to the browser.
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY

export const BUCKET_NAME =
  process.env.SUPABASE_STORAGE_BUCKET || "marketplace-images";

/**
 * Check whether a credential is missing or a placeholder.
 */
function isValidCredential(value?: string): value is string {
  if (!value?.trim()) return false;

  const normalized = value.trim().toLowerCase();

  return ![
    "your-project",
    "your-anon-key",
    "your-publishable-key",
    "your-secret-key",
    "your-service-role-key",
    "placeholder",
  ].some((placeholder) => normalized.includes(placeholder));
}

/**
 * Validate the Supabase project URL.
 */
function isValidSupabaseUrl(value?: string): value is string {
  if (!value?.trim()) return false;

  try {
    const url = new URL(value);

    return (
      ["https:", "http:"].includes(url.protocol) &&
      url.hostname.length > 0
    );
  } catch {
    return false;
  }
}

/**
 * Checks whether the public Supabase client can be initialized.
 */
export function isSupabaseConfigured(): boolean {
  return (
    isValidSupabaseUrl(supabaseUrl) &&
    isValidCredential(supabasePublicKey)
  );
}

/**
 * Checks whether privileged server-side storage operations
 * can be performed.
 */
export function isSupabaseAdminConfigured(): boolean {
  return (
    isValidSupabaseUrl(supabaseUrl) &&
    isValidCredential(supabaseSecretKey)
  );
}

/**
 * Public client.
 *
 * Uses the publishable key or legacy anon key.
 * Permissions are controlled by Supabase policies.
 */
let supabaseClientInstance: SupabaseClient | null = null;

if (isSupabaseConfigured() && supabaseUrl && supabasePublicKey) {
  supabaseClientInstance = createClient(
    supabaseUrl,
    supabasePublicKey
  );
}

/**
 * Privileged server-side client.
 *
 * Does not fall back to the public/anon key.
 * Never import this client into client components.
 */
let supabaseAdminInstance: SupabaseClient | null = null;

if (
  isSupabaseAdminConfigured() &&
  supabaseUrl &&
  supabaseSecretKey
) {
  supabaseAdminInstance = createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

export const supabase = supabaseClientInstance;
export const supabaseAdmin = supabaseAdminInstance;

/**
 * Upload an image or file buffer to Supabase Storage.
 *
 * IMPORTANT:
 * Call this function only from server-side code.
 * The configured bucket must exist.
 * The bucket must be public to return a publicly accessible URL.
 */
export async function uploadToSupabaseStorage({
  fileBuffer,
  fileName,
  contentType,
  folder = "products",
}: {
  fileBuffer: ArrayBuffer | Buffer;
  fileName: string;
  contentType: string;
  folder?: string;
}): Promise<{ url: string; path: string }> {
  if (!isSupabaseAdminConfigured() || !supabaseAdmin) {
    throw new Error(
      "Supabase server storage is not configured. Set " +
        "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY."
    );
  }

  if (!BUCKET_NAME.trim()) {
    throw new Error("Supabase storage bucket name is missing.");
  }

  if (!fileName.trim()) {
    throw new Error("File name cannot be empty.");
  }

  if (!contentType.trim()) {
    throw new Error("Content type cannot be empty.");
  }

  if (fileBuffer.byteLength === 0) {
    throw new Error("Cannot upload an empty file.");
  }

  // Sanitize folder segments and filename.
  const safeFolder = folder
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment.replace(/[^a-zA-Z0-9_-]/g, "_")
    )
    .filter(Boolean)
    .join("/");

  const sanitizedName = fileName
    .split(/[\\/]/)
    .pop()!
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  if (!sanitizedName || sanitizedName === "." || sanitizedName === "..") {
    throw new Error("Invalid file name.");
  }

  // Generate a unique object key to avoid accidental overwrites.
  const uniqueKey = [
    safeFolder,
    `${Date.now()}-${randomUUID()}-${sanitizedName}`,
  ]
    .filter(Boolean)
    .join("/");

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(uniqueKey, fileBuffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  if (!data?.path) {
    throw new Error(
      "Supabase upload succeeded but returned no file path."
    );
  }

  const { data: urlData } = supabaseAdmin.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  if (!urlData?.publicUrl) {
    throw new Error(
      "Failed to generate the Supabase public URL."
    );
  }

  return {
    url: urlData.publicUrl,
    path: data.path,
  };
}
