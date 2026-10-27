"use client";

import React, { startTransition, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import {
  ShoppingBag,
  Search,
  Store,
  ShieldCheck,
  User,
  ChevronDown,
  Package,
  Layers,
  LogOut,
  LogIn,
  UserPlus,
  X,
  Heart,
} from "lucide-react";

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, loading } = useAuth();
  const { itemCount, setIsOpen } = useCart();
  const { count: wishlistCount } = useWishlist();
  const [searchQuery, setSearchQuery] = useState("");
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    startTransition(() => setIsRoleDropdownOpen(false));
  }, [pathname]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/products");
    }
  };

  const navLinkCls = (active?: boolean) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
      active
        ? "text-violet-700 bg-violet-50"
        : "text-slate-600 hover:text-violet-700 hover:bg-slate-50"
    }`;

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-xl shadow-[0_1px_24px_rgba(0,0,0,0.08)] border-b border-black/5"
          : "bg-white/80 backdrop-blur-md border-b border-black/5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[60px] gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2.5 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center text-white shadow-md shadow-violet-200">
              <Layers className="w-5 h-5" />
            </div>
            <div className="leading-none">
              <span className="text-[17px] font-black tracking-tight text-slate-900 block">
                Market<span className="text-violet-600">Hub</span>
              </span>
              <span className="text-[9px] uppercase tracking-[0.18em] font-semibold text-violet-500 block -mt-0.5">
                Multi-Vendor
              </span>
            </div>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-lg hidden md:block">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products, stores, categories…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500 transition-all text-slate-900 placeholder:text-slate-400"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>

          {/* Navigation + Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <nav className="flex items-center space-x-0.5 text-sm font-medium">
              <Link href="/products" className={navLinkCls(pathname === "/products")}>
                Catalog
              </Link>
              <Link href="/stores" className={navLinkCls(pathname === "/stores")}>
                Stores
              </Link>

              {(user?.role === "SELLER" || user?.role === "ADMIN") && (
                <Link
                  href="/seller"
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 transition-colors"
                >
                  <Store className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Seller</span>
                </Link>
              )}

              {user?.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              )}

              {user && (
                <Link
                  href="/orders"
                  className={`${navLinkCls(pathname === "/orders")} hidden sm:flex items-center space-x-1.5`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Orders</span>
                </Link>
              )}
            </nav>

            {/* Wishlist */}
            <Link
              href="/wishlist"
              className="relative p-2 rounded-xl border border-slate-200 text-slate-600 hover:border-rose-400 hover:text-rose-600 hover:bg-rose-50 transition-all bg-white"
              aria-label="Wishlist"
              title="View Wishlist"
            >
              <Heart className={`w-5 h-5 ${wishlistCount > 0 ? "fill-rose-500 text-rose-500" : ""}`} />
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-br from-rose-500 to-rose-600 text-white text-[10px] font-black w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center shadow-md shadow-rose-300 border-2 border-white">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart */}
            <button
              onClick={() => setIsOpen(true)}
              className="relative p-2 rounded-xl border border-slate-200 text-slate-600 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all bg-white"
              aria-label="Shopping cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-gradient-to-br from-violet-600 to-violet-700 text-white text-[10px] font-black w-4.5 h-4.5 min-w-[18px] min-h-[18px] rounded-full flex items-center justify-center shadow-md shadow-violet-300 border-2 border-white">
                  {itemCount}
                </span>
              )}
            </button>

            {/* Auth */}
            {!loading && (
              <>
                {user ? (
                  <div className="relative">
                    <button
                      onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                      className="flex items-center space-x-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 text-slate-700 transition-colors border border-transparent hover:border-slate-200"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-700 text-white flex items-center justify-center font-black text-xs shadow-sm shadow-violet-200">
                        {user.name ? user.name[0].toUpperCase() : <User className="w-3.5 h-3.5" />}
                      </div>
                      <span className="hidden md:inline text-[13px] font-semibold text-slate-900 truncate max-w-[90px]">
                        {user.name?.split(" ")[0]}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isRoleDropdownOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isRoleDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsRoleDropdownOpen(false)}
                        />
                        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200/70 py-2 text-sm z-50 divide-y divide-slate-100">
                          {/* User header */}
                          <div className="px-4 py-3">
                            <p className="font-bold text-slate-900 truncate">{user.name}</p>
                            <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                            <span
                              className={`inline-block mt-2 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                user.role === "ADMIN"
                                  ? "bg-rose-100 text-rose-700"
                                  : user.role === "SELLER"
                                  ? "bg-violet-100 text-violet-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {user.role}
                            </span>
                            {user.sellerProfile && (
                              <span className="block mt-1.5 text-xs text-slate-500 truncate">
                                Store:{" "}
                                <strong className="text-slate-700">{user.sellerProfile.storeName}</strong>
                              </span>
                            )}
                          </div>

                          <div className="py-1" onClick={() => setIsRoleDropdownOpen(false)}>
                            <Link
                              href="/orders"
                              className="flex items-center space-x-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-violet-700 transition-colors"
                            >
                              <Package className="w-4 h-4 text-slate-400" />
                              <span>My Orders</span>
                            </Link>
                            {(user.role === "SELLER" || user.role === "ADMIN") && (
                              <Link
                                href="/seller"
                                className="flex items-center space-x-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 hover:text-violet-700 transition-colors"
                              >
                                <Store className="w-4 h-4 text-violet-500" />
                                <span>Seller Dashboard</span>
                              </Link>
                            )}
                            {user.role === "ADMIN" && (
                              <Link
                                href="/admin"
                                className="flex items-center space-x-3 px-4 py-2.5 text-slate-700 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                              >
                                <ShieldCheck className="w-4 h-4 text-rose-500" />
                                <span>Admin Console</span>
                              </Link>
                            )}
                            {user.role === "BUYER" && !user.sellerProfile && (
                              <Link
                                href="/seller/apply"
                                className="flex items-center space-x-3 px-4 py-2.5 text-violet-700 font-semibold hover:bg-violet-50 transition-colors"
                              >
                                <Store className="w-4 h-4" />
                                <span>Become a Seller</span>
                              </Link>
                            )}
                          </div>

                          <div className="py-1">
                            <button
                              onClick={() => { logout(); setIsRoleDropdownOpen(false); }}
                              className="w-full flex items-center space-x-3 px-4 py-2.5 text-rose-600 hover:bg-rose-50 font-semibold transition-colors"
                            >
                              <LogOut className="w-4 h-4" />
                              <span>Sign Out</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Link
                      href="/login"
                      className="px-3.5 py-2 text-[13px] font-semibold text-slate-600 hover:text-violet-700 hover:bg-slate-50 rounded-xl transition-colors flex items-center space-x-1.5"
                    >
                      <LogIn className="w-4 h-4" />
                      <span className="hidden sm:inline">Sign In</span>
                    </Link>
                    <Link
                      href="/register"
                      className="px-4 py-2 text-[13px] font-bold text-white bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 rounded-xl shadow-md shadow-violet-300/50 transition-all flex items-center space-x-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span className="hidden sm:inline">Register</span>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
