import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionEdge, COOKIE_NAME } from "./lib/jwt-verify";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionEdge(token) : null;

  // 1. Auth pages: redirect already-logged-in users away from /login and /register
  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    if (session) {
      if (session.role === "ADMIN") {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      if (session.role === "SELLER") {
        return NextResponse.redirect(new URL("/seller", request.url));
      }
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // 2. Protected routes requiring authentication
  const isProtectedPath =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/seller") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/checkout");

  if (isProtectedPath && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Admin Authorization Guard
  if (pathname.startsWith("/admin")) {
    if (session?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // 4. Seller Authorization Guard
  if (pathname.startsWith("/seller")) {
    // /seller/apply is accessible to any authenticated user wishing to register a store
    if (pathname === "/seller/apply") {
      return NextResponse.next();
    }

    if (session?.role !== "SELLER" && session?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/seller/apply", request.url));
    }
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    "/admin/:path*",
    "/seller/:path*",
    "/orders/:path*",
    "/checkout",
    "/login",
    "/register",
  ],
};
