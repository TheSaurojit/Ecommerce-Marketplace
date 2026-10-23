"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  Store,
  LayoutDashboard,
  Package,
  Layers,
  ShoppingBag,
  CreditCard,
  ExternalLink,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";

export function SellerLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // If on the application form page, render directly without the dashboard sidebar
  if (pathname === "/seller/apply") {
    return <>{children}</>;
  }

  const isApproved = user?.sellerProfile?.status === "APPROVED";
  const storeName = user?.sellerProfile?.storeName || "My Merchant Store";
  const storeSlug = user?.sellerProfile?.storeSlug || "";

  const navItems = [
    { id: "overview", label: "Dashboard Overview", icon: LayoutDashboard },
    { id: "products", label: "Product Studio", icon: Layers },
    { id: "stock", label: "Stock & Inventory", icon: Package },
    { id: "orders", label: "Order Fulfillment", icon: ShoppingBag },
    { id: "payouts", label: "Payouts & Earnings", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Mobile Header Bar */}
      <header className="lg:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center font-bold text-white text-sm shadow-md">
            <Store className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-bold truncate block">{storeName}</span>
            <span className="text-[10px] text-violet-400 font-semibold uppercase tracking-wider block">
              Seller Studio
            </span>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Sidebar for Desktop & Mobile Overlay */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-slate-300 flex flex-col justify-between transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Store Branding Header */}
          <div className="p-6 border-b border-slate-800/80">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-violet-900/30 flex-shrink-0">
                {storeName[0] ? storeName[0].toUpperCase() : <Store className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-white truncate">{storeName}</h2>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isApproved
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    {isApproved ? "Verified Merchant" : "Pending Review"}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Store Link */}
            {isApproved && storeSlug && (
              <Link
                href={`/stores/${storeSlug}`}
                target="_blank"
                className="mt-4 flex items-center justify-between px-3 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-xs text-slate-300 hover:text-white transition-colors border border-slate-700/60"
              >
                <span className="flex items-center space-x-1.5">
                  <Store className="w-3.5 h-3.5 text-violet-400" />
                  <span>View Public Storefront</span>
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              </Link>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1.5 flex-1">
            <div className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Store Operations
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <Link
                  key={item.id}
                  href={`/seller?tab=${item.id}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-violet-600 text-white shadow-md shadow-violet-900/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="px-3 py-2 rounded-xl bg-slate-800/40 border border-slate-800 text-[11px] text-slate-400 space-y-0.5">
            <span className="block text-slate-500 font-semibold uppercase text-[9px] tracking-wider">
              Platform Fee
            </span>
            <span className="text-white font-bold">
              {(Number(user?.sellerProfile?.commissionRate || 0.1) * 100).toFixed(0)}% Marketplace Split
            </span>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <Link
              href="/"
              className="flex items-center space-x-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Marketplace</span>
            </Link>

            <button
              onClick={() => logout()}
              className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Header Bar */}
        <header className="hidden lg:flex items-center justify-between h-16 px-8 bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold text-slate-400">Seller Studio</span>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-bold text-slate-900 capitalize">
              {navItems.find((n) => n.id === currentTab)?.label || "Overview"}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {isApproved ? (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Store Live & Operational</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span>Under Review by Admin</span>
              </span>
            )}

            <div className="h-5 w-px bg-slate-200" />

            <div className="flex items-center space-x-2 text-xs">
              <div className="w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                {user?.name ? user.name[0].toUpperCase() : "S"}
              </div>
              <span className="font-semibold text-slate-800">{user?.name}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
