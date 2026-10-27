"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Layers, Lock, Mail, User, Store, ArrowRight, AlertCircle, ShoppingBag, Sparkles } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [role, setRole] = useState<"BUYER" | "SELLER">("BUYER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (role === "SELLER" && (!storeName.trim() || storeName.trim().length < 2)) {
      setError("Please provide a valid store name");
      setLoading(false);
      return;
    }

    const res = await register({
      name,
      email,
      password,
      role,
      storeName: role === "SELLER" ? storeName : undefined,
      storeDescription: role === "SELLER" ? storeDescription : undefined,
    });

    setLoading(false);

    if (res.success && res.user) {
      if (res.user.role === "SELLER") {
        router.push("/seller");
      } else {
        router.push("/");
      }
    } else {
      setError(res.error || "Failed to create account");
    }
  };

  const inputCls =
    "w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-all text-slate-900 placeholder:text-slate-400";
  const inputNoPadCls =
    "w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-all text-slate-900 placeholder:text-slate-400";

  return (
    <div className="min-h-[90vh] flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-[380px] xl:w-[460px] flex-shrink-0 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d0b1e] via-violet-950 to-violet-900" />
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
              Join the Marketplace
            </div>
            <h2 className="text-4xl font-black text-white leading-tight">
              Start your<br />journey.
            </h2>
            <p className="mt-4 text-slate-300 text-sm leading-relaxed">
              Shop as a buyer or open your own merchant store — admin approval ensures every seller on MarketHub is trusted.
            </p>
          </div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} MarketHub. All rights reserved.</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14 xl:px-20 bg-[#fafaf9] overflow-y-auto">
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
          <div className="mb-7">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Create account</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Already have one?{" "}
              <Link href="/login" className="font-bold text-violet-600 hover:text-violet-800 transition-colors">
                Sign in
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

            {/* Role Selector */}
            <div>
              <label className="block text-xs font-black text-slate-700 mb-2.5 uppercase tracking-wider">
                Account Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole("BUYER")}
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    role === "BUYER"
                      ? "border-violet-400 bg-violet-50 ring-2 ring-violet-500/20"
                      : "border-slate-200 bg-slate-50 hover:bg-white"
                  }`}
                >
                  <ShoppingBag className={`w-5 h-5 flex-shrink-0 mt-0.5 ${role === "BUYER" ? "text-violet-600" : "text-slate-400"}`} />
                  <div>
                    <span className="text-[13px] font-bold text-slate-900 block">Buyer</span>
                    <span className="text-[11px] text-slate-500">Shop & track orders</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRole("SELLER")}
                  className={`p-4 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                    role === "SELLER"
                      ? "border-violet-400 bg-violet-50 ring-2 ring-violet-500/20"
                      : "border-slate-200 bg-slate-50 hover:bg-white"
                  }`}
                >
                  <Store className={`w-5 h-5 flex-shrink-0 mt-0.5 ${role === "SELLER" ? "text-violet-600" : "text-slate-400"}`} />
                  <div>
                    <span className="text-[13px] font-bold text-slate-900 block">Seller</span>
                    <span className="text-[11px] text-slate-500">Open your store</span>
                  </div>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Johnson" className={inputCls} />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@example.com" className={inputCls} />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className={inputCls} />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              {/* Seller fields */}
              {role === "SELLER" && (
                <div className="pt-2 border-t border-slate-100 space-y-4">
                  <div className="flex items-start gap-2.5 p-3.5 bg-violet-50 border border-violet-100 rounded-xl">
                    <Store className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-violet-900">
                      <span className="font-bold block mb-0.5">Store Onboarding</span>
                      <p className="text-violet-700 leading-relaxed">Your store will be created in <em>pending review</em> status until an admin approves it.</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Store Name</label>
                    <input type="text" required={role === "SELLER"} value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g. Pacific Artisan Living" className={inputNoPadCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Store Bio</label>
                    <textarea rows={2} value={storeDescription} onChange={(e) => setStoreDescription(e.target.value)} placeholder="What does your store specialise in?" className={inputNoPadCls} />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-black rounded-xl shadow-md shadow-violet-200/60 transition-all flex items-center justify-center gap-2"
              >
                {loading ? "Creating Account…" : "Create Account"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
