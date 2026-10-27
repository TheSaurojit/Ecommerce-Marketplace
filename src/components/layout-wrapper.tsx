"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { CartDrawer } from "@/components/cart-drawer";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // If user is inside the dedicated Seller Panel (excluding the public application page) or Admin Console,
  // do not render the consumer marketplace navbar, cart drawer, or footer.
  const isDashboardRoute =
    pathname.startsWith("/admin") ||
    (pathname.startsWith("/seller") && pathname !== "/seller/apply");

  if (isDashboardRoute) {
    return <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>;
  }

  return (
    <>
      <Navbar />
      <CartDrawer />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
