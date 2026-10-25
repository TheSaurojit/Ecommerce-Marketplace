"use client";

import React, { startTransition, useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { client } from "@/lib/rpc";
import type { InferResponseType } from "hono/client";
import {
  Check,
  X,
  Percent,
  ExternalLink,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
  MapPin,
} from "lucide-react";

function formatShippingAddress(address: unknown, fallbackName: string | null | undefined): string {
  const record =
    typeof address === "object" && address !== null && !Array.isArray(address)
      ? (address as Record<string, unknown>)
      : null;
  const value = (key: string) => (typeof record?.[key] === "string" ? record[key] : "");
  const name = value("fullName") || fallbackName || "";
  const parts = [name, value("addressLine"), value("city"), value("state"), value("postalCode"), value("country")]
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : "Standard Delivery Address";
}

type AdminMetricsResponse = InferResponseType<typeof client.api.admin.metrics.$get, 200>;
type AdminMetrics = AdminMetricsResponse extends { metrics: infer M } ? M : null;

type AdminSellersResponse = InferResponseType<typeof client.api.admin.sellers.$get, 200>;
type AdminSellers = AdminSellersResponse extends { sellers: infer S } ? S : [];

type AdminProductsResponse = InferResponseType<typeof client.api.admin.products.$get, 200>;
type AdminProducts = AdminProductsResponse extends { products: infer P } ? P : [];
type AdminPayoutsResponse = InferResponseType<typeof client.api.admin.payouts.$get, 200>;
type AdminPayouts = AdminPayoutsResponse extends { payouts: infer P } ? P : [];
type AdminPayoutSummary = AdminPayoutsResponse extends { summary: infer S } ? S : null;
type AdminOrdersResponse = InferResponseType<typeof client.api.admin.orders.$get, 200>;
type AdminOrders = AdminOrdersResponse extends { orders: infer O } ? O : [];

type SellerStatusFilter = "ALL" | "PENDING_APPROVAL" | "APPROVED" | "SUSPENDED" | "REJECTED";
type PayoutStatusFilter = "ALL" | "PENDING" | "TRANSFERRED" | "FAILED";

function AdminDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  // Data states
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [sellers, setSellers] = useState<AdminSellers>([]);
  const [products, setProducts] = useState<AdminProducts>([]);
  const [payouts, setPayouts] = useState<AdminPayouts>([]);
  const [payoutSummary, setPayoutSummary] = useState<AdminPayoutSummary | null>(null);
  const [globalOrders, setGlobalOrders] = useState<AdminOrders>([]);

  // Filters & selection
  const [sellerStatusFilter, setSellerStatusFilter] = useState<SellerStatusFilter>("ALL");
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<PayoutStatusFilter>("ALL");
  const [disbursingId, setDisbursingId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const fetchAdminData = useCallback(async () => {
    try {
      const [metricsRes, sellersRes, productsRes, payoutsRes, ordersRes] = await Promise.all([
        client.api.admin.metrics.$get(),
        client.api.admin.sellers.$get({
          query: { status: sellerStatusFilter },
        }),
        client.api.admin.products.$get(),
        client.api.admin.payouts.$get({
          query: { status: payoutStatusFilter },
        }),
        client.api.admin.orders.$get(),
      ]);

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics);
      }

      if (sellersRes.ok) {
        const data = await sellersRes.json();
        setSellers(data.sellers || []);
      }

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.products || []);
      }

      if (payoutsRes.ok) {
        const data = await payoutsRes.json();
        setPayouts(data.payouts || []);
        setPayoutSummary(data.summary || null);
      }

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        setGlobalOrders(data.orders || []);
      }
    } catch {
      console.error("Failed to load administrator dashboard data");
    }
  }, [sellerStatusFilter, payoutStatusFilter]);

  useEffect(() => {
    startTransition(() => {
      void fetchAdminData();
    });
  }, [fetchAdminData]);

  // Update seller application status
  const handleUpdateSellerStatus = async (
    sellerId: string,
    status: "APPROVED" | "REJECTED" | "SUSPENDED" | "PENDING_APPROVAL",
    commissionRate?: number
  ) => {
    try {
      const res = await client.api.admin.sellers[":id"].status.$patch({
        param: { id: sellerId },
        json: {
          status,
          ...(commissionRate !== undefined ? { commissionRate } : {}),
        },
      });

      if (res.ok) {
        await fetchAdminData();
      } else {
        alert("Failed to update seller status");
      }
    } catch {
      alert("Error updating seller status");
    }
  };

  // Moderate product listing
  const handleModerateProduct = async (productId: string, status: "PUBLISHED" | "ARCHIVED") => {
    try {
      const res = await client.api.admin.products[":id"].status.$patch({
        param: { id: productId },
        json: { status },
      });

      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, status } : p))
        );
      }
    } catch {
      alert("Error updating product status");
    }
  };

  // Disburse Payout to Seller
  const handleDisbursePayout = async (payoutId: string) => {
    setDisbursingId(payoutId);
    try {
      const res = await client.api.admin.payouts[":id"].status.$patch({
        param: { id: payoutId },
        json: {
          status: "TRANSFERRED",
        },
      });

      if (res.ok) {
        await fetchAdminData();
      } else {
        const data = await res.json();
        alert("error" in data && typeof data.error === "string" ? data.error : "Failed to disburse payout");
      }
    } catch {
      alert("Error processing payout disbursal");
    } finally {
      setDisbursingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* ────────────────── TAB 1: OVERVIEW & FINANCIAL PULSE ────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Financial & Platform Pulse</h1>
              <p className="text-xs text-slate-400 mt-1">
                Gross transaction volumes, retained platform fees, and network vetting velocity
              </p>
            </div>

            <button
              onClick={fetchAdminData}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center space-x-1.5 transition-colors self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Refresh Metrics</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xs space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Gross Merchandise Volume</span>
              <div className="text-2xl font-black text-white">₹{metrics?.gmv?.toFixed(2) || "0.00"}</div>
              <p className="text-[11px] text-slate-500">Total customer spend processed</p>
            </div>

            <div className="bg-slate-950 p-6 rounded-2xl border border-rose-900/40 shadow-xs space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Platform Revenue (10%)</span>
              <div className="text-2xl font-black text-rose-400">₹{metrics?.platformRevenue?.toFixed(2) || "0.00"}</div>
              <p className="text-[11px] text-slate-500">Retained marketplace take-rate</p>
            </div>

            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xs space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Active Approved Stores</span>
              <div className="text-2xl font-black text-violet-400">{metrics?.totalSellers || 0}</div>
              <p className="text-[11px] text-slate-500">Vetted merchant stores</p>
            </div>

            <div className="bg-slate-950 p-6 rounded-2xl border border-amber-900/40 shadow-xs space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Pending Seller Queue</span>
              <div className="text-2xl font-black text-amber-400">{metrics?.pendingSellersCount || 0}</div>
              <p className="text-[11px] text-slate-500">Awaiting approval review</p>
            </div>

            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xs space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Products Listed</span>
              <div className="text-2xl font-black text-white">{metrics?.totalProducts || 0}</div>
              <p className="text-[11px] text-slate-500">Catalog depth across all sellers</p>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── TAB 2: SELLER VETTING & APPROVAL ────────────────── */}
      {activeTab === "sellers" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Merchant Vetting & Approvals</h1>
              <p className="text-xs text-slate-400 mt-1">
                Inspect onboarding applicants, adjust custom commission rates, and suspend or re-approve stores
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center space-x-1.5 text-xs font-semibold">
              {(["ALL", "PENDING_APPROVAL", "APPROVED", "SUSPENDED", "REJECTED"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSellerStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    sellerStatusFilter === st
                      ? "bg-rose-600 text-white font-bold"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {st.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-6">Store & Owner</th>
                    <th className="py-3 px-6">Store Bio</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6">Commission Rate</th>
                    <th className="py-3 px-6">Catalog Size</th>
                    <th className="py-3 px-6 text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {sellers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-900/50">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-3">
                          <Image
                            src={s.logoUrl || "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=100&q=80"}
                            alt=""
                            width={40}
                            height={40}
                            unoptimized
                            className="w-10 h-10 rounded-xl object-cover bg-slate-800 border border-slate-700"
                          />
                          <div>
                            <p className="font-bold text-white">{s.storeName}</p>
                            <p className="text-[11px] text-slate-400">{s.user.name} ({s.user.email})</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 max-w-xs truncate text-slate-400">
                        {s.description || "No description provided"}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            s.status === "APPROVED"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : s.status === "PENDING_APPROVAL"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-bold text-white">{(Number(s.commissionRate) * 100).toFixed(0)}%</span>
                          <button
                            onClick={() => {
                              const newRate = prompt(
                                `Enter new commission decimal for ${s.storeName} (e.g. 0.08 for 8%):`,
                                String(s.commissionRate)
                              );
                              if (newRate !== null) {
                                handleUpdateSellerStatus(s.id, s.status, parseFloat(newRate));
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400"
                            title="Edit Commission"
                          >
                            <Percent className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-300">
                        {s._count?.products || 0} items
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        {s.status === "PENDING_APPROVAL" ? (
                          <>
                            <button
                              onClick={() => handleUpdateSellerStatus(s.id, "APPROVED")}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold inline-flex items-center space-x-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve Store</span>
                            </button>
                            <button
                              onClick={() => handleUpdateSellerStatus(s.id, "REJECTED")}
                              className="px-3 py-1 bg-rose-900/60 hover:bg-rose-900 text-rose-300 border border-rose-700/60 rounded-lg font-bold inline-flex items-center space-x-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        ) : s.status === "APPROVED" ? (
                          <button
                            onClick={() => handleUpdateSellerStatus(s.id, "SUSPENDED")}
                            className="px-3 py-1 bg-amber-950/60 hover:bg-amber-900/80 text-amber-300 border border-amber-800/60 rounded-lg font-bold"
                          >
                            Suspend Store
                          </button>
                        ) : (
                          <button
                            onClick={() => handleUpdateSellerStatus(s.id, "APPROVED")}
                            className="px-3 py-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/60 rounded-lg font-bold"
                          >
                            Re-Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── TAB 3: CATALOG MODERATION ────────────────── */}
      {activeTab === "products" && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Platform Catalog Audit & Moderation</h1>
            <p className="text-xs text-slate-400 mt-1">Audit live listings across all independent stores and de-list non-compliant items</p>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-6">Product Title</th>
                    <th className="py-3 px-6">Vendor Store</th>
                    <th className="py-3 px-6">Category</th>
                    <th className="py-3 px-6">Price</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Moderation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/50">
                      <td className="py-4 px-6">
                        <Link href={`/products/${p.slug}`} target="_blank" className="font-bold text-white hover:text-rose-400 block">
                          {p.title}
                        </Link>
                      </td>
                      <td className="py-4 px-6 text-slate-300 font-medium">{p.seller?.storeName || "Unknown Vendor"}</td>
                      <td className="py-4 px-6 text-slate-400">{p.category?.name || "General"}</td>
                      <td className="py-4 px-6 font-bold text-white">₹{Number(p.price).toFixed(2)}</td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            p.status === "PUBLISHED"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {p.status === "PUBLISHED" ? (
                          <button
                            onClick={() => handleModerateProduct(p.id, "ARCHIVED")}
                            className="px-3 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 rounded-lg font-bold"
                          >
                            De-list Listing
                          </button>
                        ) : (
                          <button
                            onClick={() => handleModerateProduct(p.id, "PUBLISHED")}
                            className="px-3 py-1 bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 rounded-lg font-bold"
                          >
                            Publish Listing
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── TAB 4: GLOBAL ORDER OVERSIGHT ────────────────── */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Global Platform Orders</h1>
              <p className="text-xs text-slate-400 mt-1">
                Cross-vendor orders, customer addresses, payment intents, and fulfillment breakdown. Click any order to inspect sub-orders & pricing.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Showing {globalOrders.length} global platform orders
            </span>
          </div>

          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-6">Master Order ID</th>
                    <th className="py-3 px-6">Buyer Details</th>
                    <th className="py-3 px-6">Vendor Shipments</th>
                    <th className="py-3 px-6">Total Amount</th>
                    <th className="py-3 px-6">Payment Status</th>
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6 text-right">Sub-Orders &amp; Pricing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {globalOrders.map((o) => {
                    const isExpanded = expandedOrderId === o.id;

                    return (
                      <React.Fragment key={o.id}>
                        {/* Parent Order Row */}
                        <tr
                          onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
                          className={`cursor-pointer transition-colors ${
                            isExpanded ? "bg-slate-900" : "hover:bg-slate-900/50"
                          }`}
                        >
                          <td className="py-4 px-6 font-mono font-bold text-white">
                            {o.id.substring(0, 12)}...
                          </td>
                          <td className="py-4 px-6">
                            <p className="font-bold text-white">{o.buyer?.name || "Customer"}</p>
                            <p className="text-[11px] text-slate-400">{o.buyer?.email}</p>
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-bold text-violet-400 block">
                              {o.subOrders?.length || 0} Vendor Sub-Orders
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5 max-w-xs truncate">
                              {o.subOrders?.map((s) => s.seller?.storeName).join(", ")}
                            </div>
                          </td>
                          <td className="py-4 px-6 font-black text-emerald-400">
                            ₹{Number(o.totalAmount).toFixed(2)}
                          </td>
                          <td className="py-4 px-6">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {o.paymentStatus}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-slate-400">
                            {new Date(o.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedOrderId(isExpanded ? null : o.id);
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 transition-all ${
                                isExpanded
                                  ? "bg-rose-600 text-white shadow-xs"
                                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                              }`}
                            >
                              <span>{isExpanded ? "Hide Details" : "View Breakdown"}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Sub-Orders & Pricing Row */}
                        {isExpanded && (
                          <tr className="bg-slate-900/90 border-b border-slate-800">
                            <td colSpan={7} className="p-6 space-y-5">
                              {/* Shipping & Order Summary Header */}
                              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800/80 text-xs">
                                <div className="flex items-start space-x-2.5">
                                  <MapPin className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <span className="font-bold text-slate-300 block">
                                      Customer Shipping Address
                                    </span>
                                    <p className="text-slate-400 mt-0.5">
                                      {formatShippingAddress(o.shippingAddress, o.buyer?.name)}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center space-x-6">
                                  <div>
                                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                                      Payment Intent
                                    </span>
                                    <span className="text-slate-300 font-mono text-[11px]">
                                      {o.stripePaymentIntentId || o.stripeSessionId || "Stripe Mock Test"}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                                      Master Order Total
                                    </span>
                                    <span className="text-base font-black text-emerald-400">
                                      ₹{Number(o.totalAmount).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Sub-Orders Grid with Individual Vendor Pricing */}
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    Vendor Sub-Orders Breakdown ({o.subOrders?.length || 0} Merchant Shipments)
                                  </h3>
                                  <span className="text-[11px] text-slate-500">
                                    Automated order split with isolated merchant accounting
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 gap-4">
                                  {o.subOrders?.map((sub) => (
                                    <div
                                      key={sub.id}
                                      className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 shadow-xs"
                                    >
                                      {/* Sub-Order Header */}
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                                        <div className="flex items-center space-x-3">
                                          <Image
                                            src={
                                              sub.seller?.logoUrl ||
                                              "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=100&q=80"
                                            }
                                            alt=""
                                            width={36}
                                            height={36}
                                            unoptimized
                                            className="w-9 h-9 rounded-xl object-cover bg-slate-800 border border-slate-700 flex-shrink-0"
                                          />
                                          <div>
                                            <div className="flex items-center space-x-2">
                                              <span className="font-bold text-white text-sm">
                                                {sub.seller?.storeName || "Merchant Store"}
                                              </span>
                                              {sub.seller?.storeSlug && (
                                                <Link
                                                  href={`/stores/${sub.seller.storeSlug}`}
                                                  target="_blank"
                                                  className="text-violet-400 hover:text-violet-300 text-[11px] inline-flex items-center space-x-0.5"
                                                >
                                                  <span>Store Profile</span>
                                                  <ExternalLink className="w-3 h-3" />
                                                </Link>
                                              )}
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                              Sub-Order ID: {sub.id}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center space-x-3">
                                          <span
                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                              sub.status === "DELIVERED"
                                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                                : sub.status === "SHIPPED"
                                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                            }`}
                                          >
                                            {sub.status}
                                          </span>
                                          {sub.trackingNumber && (
                                            <span className="text-[10px] text-slate-400 font-mono">
                                              {sub.carrierName || "Carrier"}: {sub.trackingNumber}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Line Items List */}
                                      <div className="space-y-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                          Items Purchased From This Vendor
                                        </span>
                                        <div className="divide-y divide-slate-800/60 bg-slate-900/60 rounded-xl p-3 border border-slate-800/60">
                                          {sub.items?.map((item) => (
                                            <div
                                              key={item.id}
                                              className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                                            >
                                              <div className="flex items-center space-x-3 min-w-0">
                                                <Image
                                                  src={
                                                    item.product?.images?.[0]?.url ||
                                                    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=100&q=80"
                                                  }
                                                  alt=""
                                                  width={36}
                                                  height={36}
                                                  unoptimized
                                                  className="w-9 h-9 rounded-lg object-cover bg-slate-800 border border-slate-700 flex-shrink-0"
                                                />
                                                <div className="min-w-0">
                                                  {item.product?.slug ? (
                                                    <Link
                                                      href={`/products/${item.product.slug}`}
                                                      target="_blank"
                                                      className="font-bold text-slate-200 hover:text-rose-400 truncate block max-w-xs sm:max-w-md"
                                                    >
                                                      {item.product?.title || "Product Listing"}
                                                    </Link>
                                                  ) : (
                                                    <span className="font-bold text-slate-200 truncate block max-w-xs sm:max-w-md">
                                                      {item.product?.title || "Product Listing"}
                                                    </span>
                                                  )}
                                                  <span className="text-[10px] text-slate-500 block">
                                                    Quantity: {item.quantity} &times; ₹{Number(item.unitPrice).toFixed(2)} each
                                                  </span>
                                                </div>
                                              </div>

                                              <div className="text-right flex-shrink-0">
                                                <span className="font-bold text-white text-xs">
                                                  ₹{(Number(item.unitPrice) * item.quantity).toFixed(2)}
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>

                                      {/* Sub-Order Pricing Split Details */}
                                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                                        <div className="flex items-center space-x-6">
                                          <div>
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                              Vendor Subtotal
                                            </span>
                                            <span className="font-black text-slate-200 text-sm">
                                              ₹{Number(sub.subtotal).toFixed(2)}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">
                                              Platform Commission (10%)
                                            </span>
                                            <span className="font-black text-rose-400 text-sm">
                                              -₹{Number(sub.commissionAmount).toFixed(2)}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="text-right">
                                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                                            Net Seller Payout (Disbursable)
                                          </span>
                                          <span className="text-base font-black text-emerald-400">
                                            ₹{Number(sub.sellerPayout).toFixed(2)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── TAB 5: SELLER PAYOUT MANAGEMENT ────────────────── */}
      {activeTab === "payouts" && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Seller Payout Disbursals & Ledger</h1>
            <p className="text-xs text-slate-400 mt-1">
              Audit automated commission deductions, execute direct deposits, and verify Stripe Connect merchant transfers
            </p>
          </div>

          {/* Payout Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Pending Merchant Disbursals</span>
              <div className="text-2xl font-black text-amber-400">₹{payoutSummary?.pendingTotal?.toFixed(2) || "0.00"}</div>
              <p className="text-[11px] text-slate-500">Unsettled vendor payouts</p>
            </div>

            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Total Settled / Transferred</span>
              <div className="text-2xl font-black text-emerald-400">₹{payoutSummary?.transferredTotal?.toFixed(2) || "0.00"}</div>
              <p className="text-[11px] text-slate-500">Disbursed to merchant accounts</p>
            </div>

            <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payout Settlement Engine</span>
              <div className="flex items-center space-x-1.5 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-bold text-white text-sm">Stripe Connect Ready</span>
              </div>
              <p className="text-[11px] text-slate-500">Automated ledger calculates net take & vendor splits</p>
            </div>
          </div>

          {/* Filter Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs font-semibold">
              {(["ALL", "PENDING", "TRANSFERRED", "FAILED"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setPayoutStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    payoutStatusFilter === st
                      ? "bg-rose-600 text-white font-bold"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-400 font-medium">
              {payouts.length} payout records found
            </span>
          </div>

          {/* Payout Records Table */}
          <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-6">Merchant Store</th>
                    <th className="py-3 px-6">Sub-Order Reference</th>
                    <th className="py-3 px-6">Order Subtotal</th>
                    <th className="py-3 px-6">Platform Fee Retained</th>
                    <th className="py-3 px-6">Net Seller Payout</th>
                    <th className="py-3 px-6">Payout Status</th>
                    <th className="py-3 px-6 text-right">Transfer Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-900/50">
                      <td className="py-4 px-6">
                        <p className="font-bold text-white">{p.seller?.storeName || "Merchant"}</p>
                        <p className="text-[11px] text-slate-400">{p.seller?.user?.email}</p>
                      </td>
                      <td className="py-4 px-6 font-mono text-slate-400">
                        {p.subOrder?.id?.substring(0, 12)}...
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-300">
                        ₹{Number(p.subOrder?.subtotal || 0).toFixed(2)}
                      </td>
                      <td className="py-4 px-6 font-bold text-rose-400">
                        -₹{Number(p.subOrder?.commissionAmount || 0).toFixed(2)}
                      </td>
                      <td className="py-4 px-6 font-black text-emerald-400 text-sm">
                        ₹{Number(p.amount).toFixed(2)}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            p.status === "TRANSFERRED"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : p.status === "PENDING"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        {p.status === "PENDING" ? (
                          <button
                            onClick={() => handleDisbursePayout(p.id)}
                            disabled={disbursingId === p.id}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold inline-flex items-center space-x-1.5 transition-colors shadow-xs disabled:bg-slate-700"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{disbursingId === p.id ? "Disbursing..." : "Disburse Funds"}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">
                            {p.stripeTransferId ? `${p.stripeTransferId.substring(0, 12)}...` : "Settled"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-500">Loading Admin Console...</div>}>
      <AdminDashboardContent />
    </Suspense>
  );
}
