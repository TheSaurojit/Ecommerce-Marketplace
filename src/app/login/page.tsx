"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Layers, Lock, Mail, ArrowRight, AlertCircle, Sparkles } from "lucide-react";

const QUICK_FILLS = [
  { label: "Admin", email: "admin@marketplace.com", pass: "admin123", color: "rose" },
  { label: "Seller (Apex)", email: "apex@marketplace.com", pass: "seller123", color: "violet" },
  { label: "Buyer", email: "buyer@marketplace.com", pass: "buyer123", color: "slate" },
];

const colorMap: Record<string, string> = {
  rose: "border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800",
  violet: "border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-800",
  slate: "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700",
};

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "";

  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await login(email, password);
    setLoading(false);

    if (res.success && res.user) {
      if (redirectPath) {
        router.push(redirectPath);
      } else if (res.user.role === "ADMIN") {
        router.push("/admin");
      } else if (res.user.role === "SELLER") {
        router.push("/seller");
      } else {
        router.push("/");
      }
    } else {
      setError(res.error || "Invalid email or password");
    }
  };

  const inputCls =
    "w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-all text-slate-900 placeholder:text-slate-400";

  return (
    <div className="min-h-[90vh] flex">
      {/* Left decorative panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[500px] flex-shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d0b1e] via-violet-950 to-violet-900" />
        {/* Blobs */}
        <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-violet-600/30 blur-[100px]" />
        <div className="absolute bottom-10 right-0 w-80 h-80 rounded-full bg-fuchsia-700/20 blur-[80px]" />
        <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.1)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative z-10 flex flex-col justify-between p-12 h-full">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black text-white tracking-tight">MarketHub</span>
          </Link>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-violet-200 text-[11px] font-bold uppercase tracking-wider mb-6">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Multi-Vendor Marketplace
            </div>
            <h2 className="text-4xl font-black text-white leading-tight">
              Welcome<br />back.
            </h2>
            <p className="mt-4 text-slate-300 text-sm leading-relaxed">
              Sign in to shop across verified independent stores, track your deliveries, and manage your seller dashboard.
            </p>
            <div className="mt-10 space-y-3">
              {["Multi-vendor shopping cart", "Real-time order tracking", "Secure Stripe payments", "Seller & admin dashboards"].map((f) => (
                <div key={f} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <span className="w-5 h-5 rounded-full bg-violet-600/40 border border-violet-400/30 flex items-center justify-center flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-300" />
                  </span>
                  {f}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} MarketHub. All rights reserved.</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24 bg-[#fafaf9]">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 flex justify-center">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-white">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-xl font-black text-slate-900">MarketHub</span>
          </Link>
        </div>

        <div className="w-full max-w-md mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Sign in</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              New here?{" "}
              <Link href="/register" className="font-bold text-violet-600 hover:text-violet-800 transition-colors">
                Create an account
              </Link>
            </p>
          </div>

          <div className="bg-white rounded-3xl shadow-[0_2px_24px_rgba(0,0,0,0.07)] border border-slate-100 p-8 space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputCls}
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 py-3.5 px-4 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-black rounded-xl shadow-md shadow-violet-200/60 transition-all flex items-center justify-center gap-2"
              >
                {loading ? "Verifying…" : "Sign In"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

            {/* Quick fill */}
            <div className="border-t border-slate-100 pt-5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                Quick Fill — Seeded Accounts
              </p>
              <div className="grid grid-cols-3 gap-2">
                {QUICK_FILLS.map(({ label, email: e, pass: p, color }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { setEmail(e); setPassword(p); setError(""); }}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-colors ${colorMap[color]}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-slate-500">Loading…</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
