import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

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

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;

  const dbUser = await db.user.findUnique({
    where: { id: session.userId },
    include: { sellerProfile: true },
  });

  if (!dbUser) return null;

  return {
    userId: dbUser.id,
    email: dbUser.email,
    role: dbUser.role as "BUYER" | "SELLER" | "ADMIN",
    sellerProfileId: dbUser.sellerProfile?.id,
    storeName: dbUser.sellerProfile?.storeName,
    storeStatus: dbUser.sellerProfile?.status,
  };
}

export async function signRealtimeToken(payload: {
  userId: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  sellerProfileId?: string;
}): Promise<string> {
  const rawSecret = process.env.SUPABASE_JWT_SECRET;
  if (!rawSecret || rawSecret.trim().length === 0) {
    throw new Error(
      "SUPABASE_JWT_SECRET is missing. Cannot sign tokens for Supabase Realtime without the Supabase Project JWT Secret."
    );
  }

  const secret = rawSecret.trim().replace(/^["']|["']$/g, "");

  // Detect if user supplied a Key ID (UUID) from Supabase's Asymmetric Signing Keys architecture
  const isUuidKeyId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(secret);
  if (isUuidKeyId) {
    throw new Error(
      "SUPABASE_JWT_SECRET is set to an Asymmetric Key ID (UUID), not a symmetric shared secret. Your Supabase project uses Asymmetric Signing Keys (RS256/ES256). Authenticated channels will use the authenticated SSE transport."
    );
  }

  return new SignJWT({
    sub: payload.userId,
    aud: "authenticated",
    role: "authenticated",
    userId: payload.userId,
    sellerProfileId: payload.sellerProfileId || "",
    userRole: payload.role,
    iss: "supabase",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(new TextEncoder().encode(secret));
}
