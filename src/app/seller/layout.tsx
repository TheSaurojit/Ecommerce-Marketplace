import React, { Suspense } from "react";
import { SellerLayoutClient } from "./seller-layout-client";

export const dynamic = "force-dynamic";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-400">
          Loading Seller Portal...
        </div>
      }
    >
      <SellerLayoutClient>{children}</SellerLayoutClient>
    </Suspense>
  );
}
