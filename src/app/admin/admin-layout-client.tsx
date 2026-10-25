"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  ShieldCheck,
  LayoutDashboard,
  Store,
  Layers,
  ShoppingBag,
  CreditCard,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  ChevronRight,
  Activity,
} from "lucide-react";

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "overview";
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: "overview", label: "Financial Pulse & KPIs", icon: LayoutDashboard },
    { id: "sellers", label: "Merchant Vetting Queue", icon: Store },
    { id: "products", label: "Catalog Moderation", icon: Layers },
    { id: "orders", label: "Global Order Oversight", icon: ShoppingBag },
    { id: "payouts", label: "Payout Disbursals", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col lg:flex-row">
      {/* Mobile Header Bar */}
      <header className="lg:hidden bg-slate-950 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center font-bold text-white text-sm shadow-md">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-sm font-bold block">MarketHub Admin</span>
            <span className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider block">
              Super Admin Console
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
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-slate-300 flex flex-col justify-between transition-transform duration-300 lg:static lg:translate-x-0 border-r border-slate-800/80 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Admin Header */}
          <div className="p-6 border-b border-slate-800/80">
            <div className="flex items-center space-x-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-600 to-rose-800 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-rose-900/40 flex-shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-white tracking-tight">MarketHub Console</h2>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    Super Admin
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-4 space-y-1.5 flex-1">
            <div className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Platform Governance
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <Link
                  key={item.id}
                  href={`/admin?tab=${item.id}`}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-rose-600 text-white shadow-md shadow-rose-900/30"
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
          <div className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold text-[10px] uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5" />
              <span>Multi-Vendor Engine</span>
            </div>
            <p className="text-slate-500 text-[10px]">PostgreSQL 16 · Prisma 7 · Hono RPC</p>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <Link
              href="/"
              className="flex items-center space-x-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Consumer View</span>
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
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
        {/* Desktop Top Header Bar */}
        <header className="hidden lg:flex items-center justify-between h-16 px-8 bg-slate-950/80 backdrop-blur border-b border-slate-800/80 sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-semibold text-slate-500">Platform Admin</span>
            <span className="text-slate-700">/</span>
            <span className="text-sm font-bold text-white capitalize">
              {navItems.find((n) => n.id === currentTab)?.label || "Overview"}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold text-rose-300 bg-rose-950/60 border border-rose-800/50">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>Full Moderation & Financial Authority</span>
            </span>

            <div className="h-5 w-px bg-slate-800" />

            <div className="flex items-center space-x-2 text-xs">
              <div className="w-7 h-7 rounded-lg bg-rose-900/60 border border-rose-700/50 text-rose-300 flex items-center justify-center font-bold">
                A
              </div>
              <span className="font-semibold text-slate-300">{user?.name || "Administrator"}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
