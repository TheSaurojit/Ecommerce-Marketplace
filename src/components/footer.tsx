import React from "react";
import Link from "next/link";
import { Layers, ShieldCheck, Truck, RefreshCw, CreditCard, Mail, Globe, Code2 } from "lucide-react";

const TRUST_ITEMS = [
  { icon: ShieldCheck, title: "Vetted Sellers", desc: "Every store admin-approved", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { icon: CreditCard, title: "Stripe Payments", desc: "Automated order splits & payouts", color: "text-violet-400", bg: "bg-violet-500/10" },
  { icon: Truck, title: "Live Tracking", desc: "Carrier fulfillment timeline", color: "text-sky-400", bg: "bg-sky-500/10" },
  { icon: RefreshCw, title: "Multi-Vendor Cart", desc: "Shop multiple stores, one checkout", color: "text-amber-400", bg: "bg-amber-500/10" },
];

const LINKS = {
  Marketplace: [
    { label: "Browse Products", href: "/products" },
    { label: "All Stores", href: "/stores" },
    { label: "My Orders", href: "/orders" },
    { label: "Shopping Cart", href: "#" },
  ],
  Sellers: [
    { label: "Seller Dashboard", href: "/seller" },
    { label: "Apply to Sell", href: "/seller/apply" },
    { label: "Analytics", href: "/seller" },
    { label: "Order Management", href: "/seller" },
  ],
  Platform: [
    { label: "Admin Console", href: "/admin" },
    { label: "Create Account", href: "/register" },
    { label: "Sign In", href: "/login" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-[#0d0b1e] text-slate-400 mt-24 relative overflow-hidden">
      {/* Top glow */}
      <div className="absolute top-0 left-1/4 w-96 h-40 bg-violet-700/10 blur-[80px] pointer-events-none" />

      {/* Trust badges */}
      <div className="border-b border-white/5 py-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {TRUST_ITEMS.map(({ icon: Icon, title, desc, color, bg }) => (
            <div key={title} className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${bg} flex-shrink-0`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">{title}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Links grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand col */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
                <Layers className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-lg font-black text-white">
                Market<span className="text-violet-400">Hub</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">
              A full-stack multi-vendor marketplace built with Next.js, Hono.js, PostgreSQL & Stripe.
            </p>
            <div className="flex items-center gap-3 mt-5">
              {[Globe, Code2, Mail].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link cols */}
          {Object.entries(LINKS).map(([category, links]) => (
            <div key={category}>
              <h5 className="text-[11px] font-black text-white uppercase tracking-widest mb-4">{category}</h5>
              <ul className="space-y-2.5">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-xs text-slate-500 hover:text-violet-400 transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5 py-6 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-600">
          <span>© {new Date().getFullYear()} MarketHub — Next.js · Hono · PostgreSQL · Stripe Architecture Demo</span>
          <div className="flex items-center gap-4">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
