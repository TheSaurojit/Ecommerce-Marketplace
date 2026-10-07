import { jwtVerify } from "jose";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "FATAL: JWT_SECRET environment variable is missing or empty. A secure secret must be configured."
    );
  }
  return new TextEncoder().encode(secret);
}

export const COOKIE_NAME = "marketplace_session";

export interface SessionPayload {
  userId: string;
  email: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  sellerProfileId?: string;
  storeName?: string;
  storeStatus?: string;
}

export async function verifySessionEdge(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
