import { PrismaClient } from "@/generated/prisma/client";

/**
 * Generates a URL-safe, unique store slug.
 * Checks against the database and appends a short unique identifier if the slug already exists.
 */
export async function generateUniqueStoreSlug(
  db: PrismaClient,
  storeName: string
): Promise<string> {
  const baseSlug = storeName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "store";

  // Check if base slug is free
  const existing = await db.sellerProfile.findUnique({
    where: { storeSlug: baseSlug },
    select: { id: true },
  });

  if (!existing) {
    return baseSlug;
  }

  // If taken, generate a unique variant with a short random alphanumeric suffix
  for (let attempt = 1; attempt <= 10; attempt++) {
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const candidateSlug = `${baseSlug}-${randomSuffix}`;

    const candidateExists = await db.sellerProfile.findUnique({
      where: { storeSlug: candidateSlug },
      select: { id: true },
    });

    if (!candidateExists) {
      return candidateSlug;
    }
  }

  // Fallback with timestamp
  return `${baseSlug}-${Date.now().toString(36)}`;
}

/**
 * Generates a unique product slug based on product title.
 */
export async function generateUniqueProductSlug(
  db: PrismaClient,
  title: string
): Promise<string> {
  const baseSlug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "product";

  const randomSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
  return `${baseSlug}-${randomSuffix}`;
}
