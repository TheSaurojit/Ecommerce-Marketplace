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
  const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error("FATAL: JWT secret is missing.");
  }

  return new SignJWT({
    sub: payload.userId,
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
