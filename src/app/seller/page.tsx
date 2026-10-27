"use client";

import React, { startTransition, useCallback, useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { client } from "@/lib/rpc";
import type { InferResponseType } from "hono/client";
import {
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  Edit3,
  Search,
  Eye,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ImageUpload } from "@/components/image-upload";

type SellerAnalyticsResponse = InferResponseType<typeof client.api.analytics.seller.$get, 200>;
type SellerAnalytics = SellerAnalyticsResponse extends { summary: unknown } ? SellerAnalyticsResponse : null;
type SellerOrdersResponse = InferResponseType<typeof client.api.orders["seller-orders"]["$get"], 200>;
type SellerSubOrders = SellerOrdersResponse extends { subOrders: infer S } ? S : [];
type SellerSubOrder = SellerSubOrders extends Array<infer S> ? S : never;
type SellerProductsResponse = InferResponseType<typeof client.api.products["seller-products"]["$get"], 200>;
type SellerProducts = SellerProductsResponse extends { products: infer P } ? P : [];
type SellerProduct = SellerProducts extends Array<infer P> ? P : never;
type SellerCategoriesResponse = InferResponseType<typeof client.api.categories.$get, 200>;
type SellerCategories = SellerCategoriesResponse extends { categories: infer C } ? C : [];
type SellerCategory = SellerCategories extends Array<infer C> ? C : never;
type CreatedProductResponse = InferResponseType<typeof client.api.products.$post, 201>;
type CreatedProduct = CreatedProductResponse extends { product: infer P } ? P : null;
type FulfillmentStatus = "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

function getFulfillmentStatus(status: SellerSubOrder["status"]): FulfillmentStatus {
  if (status === "PROCESSING") return "SHIPPED";
  if (status === "REFUNDED") return "PROCESSING";
  return status;
}

function getAddressValue(address: unknown, key: string): string {
  if (typeof address !== "object" || address === null || Array.isArray(address)) {
    return "";
  }
  const value = (address as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatApiError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (!isRecord(error)) return "An unexpected error occurred";
  if (typeof error.error === "string") return error.error;
  if (typeof error.message === "string") return error.message;

  const nestedError = error.error;
  if (
    isRecord(nestedError) &&
    nestedError.name === "ZodError" &&
    typeof nestedError.message === "string"
  ) {
    try {
      const parsed: unknown = JSON.parse(nestedError.message);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .map((issue) => {
            if (!isRecord(issue)) return "Invalid value";
            const path = Array.isArray(issue.path)
              ? issue.path.map(String).join(".")
              : "";
            const message = typeof issue.message === "string" ? issue.message : "Invalid value";
            return path ? `${path}: ${message}` : message;
          })
          .join(" | ");
      }
    } catch {
      return "Validation failed. Please review the highlighted fields.";
    }
  }

  const formatEntries = (entries: unknown): string | null => {
    if (!Array.isArray(entries) || entries.length === 0) return null;
    return entries
      .map((entry) => {
        if (!isRecord(entry)) return "Invalid value";
        const path = Array.isArray(entry.path) ? entry.path.map(String).join(".") : "";
        const field = typeof entry.field === "string" ? entry.field : path;
        const message = typeof entry.message === "string" ? entry.message : "Invalid value";
        return field ? `${field}: ${message}` : message;
      })
      .join(" | ");
  };

  return (
    formatEntries(error.errors) ??
    formatEntries(error.details) ??
    "Validation failed. Please review the highlighted fields."
  );
}

function SellerDashboardContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { user } = useAuth();

  // Data states
  const [analytics, setAnalytics] = useState<SellerAnalytics | null>(null);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [orders, setOrders] = useState<SellerSubOrder[]>([]);
  const [categories, setCategories] = useState<SellerCategory[]>([]);

  // Search & Filter states
  const [productSearch, setProductSearch] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState<
    "ALL_ACTIVE" | "PUBLISHED" | "DRAFT" | "OUT_OF_STOCK" | "ARCHIVED"
  >("ALL_ACTIVE");
  const [stockFilter, setStockFilter] = useState<"ALL" | "HEALTHY" | "LOW" | "OUT">("ALL");
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL");
  const [orderSearch, setOrderSearch] = useState("");

  // New Product Modal State
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    title: "",
    description: "",
    price: "",
    comparePrice: "",
    inventoryCount: "0",
    categoryId: "",
    imageUrl: "",
    featured: false,
  });
  const [savingProduct, setSavingProduct] = useState(false);
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [createdProductPopup, setCreatedProductPopup] = useState<CreatedProduct | null>(null);

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<SellerProduct | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    price: "",
    comparePrice: "",
    inventoryCount: "0",
    categoryId: "",
    imageUrl: "",
    status: "PUBLISHED" as "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "OUT_OF_STOCK" | "ARCHIVED",
    featured: false,
  });
  const [updatingProduct, setUpdatingProduct] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Fulfillment Modal State
  const [selectedSubOrder, setSelectedSubOrder] = useState<SellerSubOrder | null>(null);
  const [fulfillmentForm, setFulfillmentForm] = useState<{
    status: FulfillmentStatus;
    trackingNumber: string;
    carrierName: string;
  }>({
    status: "SHIPPED",
    trackingNumber: "",
    carrierName: "",
  });
  const [updatingFulfillment, setUpdatingFulfillment] = useState(false);

  // Quick Stock Adjustment Indicator
  const [quickUpdateId, setQuickUpdateId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, ordersRes, categoriesRes, productsRes] = await Promise.all([
        client.api.analytics.seller.$get(),
        client.api.orders["seller-orders"].$get(),
        client.api.categories.$get(),
        client.api.products["seller-products"].$get({
          query: {
            status: productStatusFilter,
            limit: "100",
          },
        }),
      ]);

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data);
      }

      if (ordersRes.ok) {
        const data = await ordersRes.json();
        if ("subOrders" in data) {
          setOrders(data.subOrders || []);
        }
      }

      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data.categories || []);
        if (data.categories?.length > 0) {
          setProductForm((prev) => ({ ...prev, categoryId: data.categories[0].id }));
        }
      }

      if (productsRes.ok) {
        const data = await productsRes.json();
        if ("products" in data) {
          setProducts(data.products || []);
        }
      }
    } catch {
      console.error("Failed to load seller dashboard data");
    }
  }, [productStatusFilter]);

  useEffect(() => {
    startTransition(() => {
      void fetchData();
    });
  }, [fetchData, user?.id]);

  // Create Product
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductFormError(null);
    setSavingProduct(true);
    try {
      const res = await client.api.products.$post({
        json: {
          title: productForm.title,
          description: productForm.description,
          price: parseFloat(productForm.price),
          comparePrice: productForm.comparePrice ? parseFloat(productForm.comparePrice) : undefined,
          inventoryCount: parseInt(productForm.inventoryCount, 10),
          categoryId: productForm.categoryId || categories[0]?.id,
          images: [productForm.imageUrl],
          featured: productForm.featured,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setIsNewProductOpen(false);
        setProductFormError(null);
        setProductForm({
          title: "",
          description: "",
          price: "",
          comparePrice: "",
          inventoryCount: "0",
          categoryId: categories[0]?.id || "",
          imageUrl: "",
          featured: false,
        });
        if ("product" in data && data.product) {
          setCreatedProductPopup(data.product);
        }
        await fetchData();
      } else {
        const err = await res.json();
        const errorMessage = formatApiError(err);
        setProductFormError(errorMessage);
        alert(errorMessage);
      }
    } catch (ex: unknown) {
      const msg = ex instanceof Error ? ex.message : "Error creating product";
      setProductFormError(msg);
      alert(msg);
    } finally {
      setSavingProduct(false);
    }
  };

  // Open Edit Product Modal
  const handleOpenEdit = (p: SellerProduct) => {
    setEditFormError(null);
    setEditingProduct(p);
    setEditForm({
      title: p.title,
      description: p.description,
      price: String(p.price),
      comparePrice: p.comparePrice ? String(p.comparePrice) : "",
      inventoryCount: String(p.inventoryCount),
      categoryId: p.category?.id || "",
      imageUrl: p.images?.[0]?.url || "",
      status: p.status,
      featured: Boolean(p.featured),
    });
  };

  // Submit Product Edit
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    setEditFormError(null);
    setUpdatingProduct(true);
    try {
      const res = await client.api.products[":id"].$patch({
        param: { id: editingProduct.id },
        json: {
          title: editForm.title,
          description: editForm.description,
          price: parseFloat(editForm.price),
          comparePrice: editForm.comparePrice ? parseFloat(editForm.comparePrice) : null,
          inventoryCount: parseInt(editForm.inventoryCount, 10),
          categoryId: editForm.categoryId,
          status: editForm.status,
          images: editForm.imageUrl ? [editForm.imageUrl] : undefined,
          featured: editForm.featured,
        },
      });

      if (res.ok) {
        setEditingProduct(null);
        setEditFormError(null);
        await fetchData();
      } else {
        const err = await res.json();
        const errorMessage = formatApiError(err);
        setEditFormError(errorMessage);
        alert(errorMessage);
      }
    } catch (ex: unknown) {
      const msg = ex instanceof Error ? ex.message : "Error updating product";
      setEditFormError(msg);
      alert(msg);
    } finally {
      setUpdatingProduct(false);
    }
  };

  // Quick Stock Adjustment
  const handleQuickStockUpdate = async (productId: string, newCount: number) => {
    const updatedStock = Math.max(0, newCount);
    setQuickUpdateId(productId);
    try {
      const res = await client.api.products[":id"].$patch({
        param: { id: productId },
        json: { inventoryCount: updatedStock },
      });

      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, inventoryCount: updatedStock } : p))
        );
      }
    } catch {
      // ignore
    } finally {
      setTimeout(() => setQuickUpdateId(null), 1000);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const res = await client.api.products[":id"].$delete({ param: { id } });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
      alert("Failed to delete product");
    }
  };

  // Update Order Fulfillment
  const handleUpdateFulfillment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubOrder) return;

    setUpdatingFulfillment(true);
    try {
      const res = await client.api.orders["seller-orders"][":id"].status.$patch({
        param: { id: selectedSubOrder.id },
        json: fulfillmentForm,
      });

      if (res.ok) {
        setSelectedSubOrder(null);
        await fetchData();
      } else {
        const err = await res.json();
        alert(("error" in err && typeof err.error === "string" ? err.error : "Failed to update fulfillment status"));
      }
    } catch {
      alert("Error updating fulfillment");
    } finally {
      setUpdatingFulfillment(false);
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.title.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.slug.toLowerCase().includes(productSearch.toLowerCase());
      if (!matchSearch) return false;

      if (stockFilter === "HEALTHY") return p.inventoryCount > 5;
      if (stockFilter === "LOW") return p.inventoryCount > 0 && p.inventoryCount <= 5;
      if (stockFilter === "OUT") return p.inventoryCount <= 0;
      return true;
    });
  }, [products, productSearch, stockFilter]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = orderStatusFilter === "ALL" || o.status === orderStatusFilter;
      if (!matchStatus) return false;

      if (!orderSearch) return true;
      const q = orderSearch.toLowerCase();
      const matchId = o.id.toLowerCase().includes(q);
      const matchBuyer = (o.order.buyer?.name || "").toLowerCase().includes(q);
      const matchCarrier = (o.carrierName || "").toLowerCase().includes(q);
      const matchTracking = (o.trackingNumber || "").toLowerCase().includes(q);
      return matchId || matchBuyer || matchCarrier || matchTracking;
    });
  }, [orders, orderStatusFilter, orderSearch]);

  const isPending = user?.sellerProfile?.status === "PENDING_APPROVAL";

  // Stock summary metrics (Active non-archived products only)
  const activeProducts = products.filter((p) => p.status !== "ARCHIVED");
  const healthyStockCount = activeProducts.filter((p) => p.inventoryCount > 5).length;
  const lowStockCount = activeProducts.filter((p) => p.inventoryCount > 0 && p.inventoryCount <= 5).length;
  const outOfStockCount = activeProducts.filter((p) => p.inventoryCount <= 0).length;
  const totalStockUnits = activeProducts.reduce((sum, p) => sum + (p.inventoryCount || 0), 0);

  return (
    <div className="space-y-8">
      {/* Pending Banner */}
      {isPending && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start space-x-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h3 className="font-bold text-sm">Store Pending Administrator Approval</h3>
            <p>
              Your store <strong>{user?.sellerProfile?.storeName}</strong> is undergoing vetting. Once an admin approves it, your products will be published publicly.
            </p>
          </div>
        </div>
      )}

      {/* ────────────────── TAB 1: OVERVIEW & ANALYTICS ────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {/* Header Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sales & Analytics Overview</h1>
              <p className="text-xs text-slate-500 mt-1">Real-time revenue, commission fees, and performance metrics</p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={fetchData}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center space-x-1.5 transition-all shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Sync Metrics</span>
              </button>

            </div>
          </div>

          {/* Key Financial KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Sales Volume</span>
              <div className="text-2xl font-black text-slate-900">₹{analytics?.summary?.grossSales?.toFixed(2) || "0.00"}</div>
              <p className="text-[11px] text-slate-400">Total customer checkout spend</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Net Seller Earnings</span>
              <div className="text-2xl font-black text-emerald-600">₹{analytics?.summary?.netEarnings?.toFixed(2) || "0.00"}</div>
              <p className="text-[11px] text-slate-400">Disbursed to merchant balance</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Marketplace Fee (10%)</span>
              <div className="text-2xl font-black text-slate-700">₹{analytics?.summary?.commissionPaid?.toFixed(2) || "0.00"}</div>
              <p className="text-[11px] text-slate-400">Retained platform commission</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-2">
              <span className="text-xs font-bold text-violet-600 uppercase tracking-wider">Sub-Orders Received</span>
              <div className="text-2xl font-black text-violet-600">{analytics?.summary?.totalOrders || orders.length}</div>
              <p className="text-[11px] text-slate-400">Fulfilled merchant shipments</p>
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Revenue Velocity</h2>
                <p className="text-xs text-slate-400">Gross customer spend vs. Net seller take-home</p>
              </div>
              <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2.5 py-1 rounded-lg">
                Daily Activity
              </span>
            </div>

            <div className="h-64 w-full">
              {analytics?.chartData && analytics.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.chartData}>
                    <defs>
                      <linearGradient id="grossGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="gross" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#grossGradient)" name="Gross Sales (₹)" />
                    <Area type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#netGradient)" name="Net Payout (₹)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                  Complete orders to generate sales velocity charts.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── TAB 2: PRODUCT STUDIO (FULL EDITING) ────────────────── */}
      {activeTab === "products" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Product Studio</h1>
              <p className="text-xs text-slate-500 mt-1">Manage catalog listings, descriptions, pricing, and live status</p>
            </div>

            <button
              onClick={() => {
                setProductFormError(null);
                setIsNewProductOpen(true);
              }}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Create Product</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            {/* Search and Filters */}
            <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                {(
                  [
                    { id: "ALL_ACTIVE", label: "Active Listings" },
                    { id: "PUBLISHED", label: "Published" },
                    { id: "DRAFT", label: "Drafts" },
                    { id: "OUT_OF_STOCK", label: "Out of Stock" },
                    { id: "ARCHIVED", label: "Archived" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setProductStatusFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg transition-colors ${
                      productStatusFilter === tab.id
                        ? "bg-violet-600 text-white font-bold shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    placeholder="Search products by title or slug..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 text-slate-900"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
                <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                  {filteredProducts.length} items
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-6">Product</th>
                    <th className="py-3 px-6">Category</th>
                    <th className="py-3 px-6">Pricing</th>
                    <th className="py-3 px-6">Stock Status</th>
                    <th className="py-3 px-6">Listing Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-4 px-6 flex items-center space-x-3">
                        <Image
                          src={p.images[0]?.url || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=100&q=80"}
                          alt=""
                          width={44}
                          height={44}
                          unoptimized
                          className="w-11 h-11 rounded-xl object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <Link href={`/products/${p.slug}`} target="_blank" className="font-bold text-slate-900 hover:text-violet-600 truncate block">
                            {p.title}
                          </Link>
                          <span className="text-[10px] text-slate-400 font-mono">/products/{p.slug}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-600 font-medium">{p.category?.name || "General"}</td>
                      <td className="py-4 px-6">
                        <div className="font-bold text-slate-900">₹{Number(p.price).toFixed(2)}</div>
                        {p.comparePrice && (
                          <div className="text-[10px] text-slate-400 line-through">₹{Number(p.comparePrice).toFixed(2)}</div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            p.inventoryCount > 5
                              ? "bg-emerald-100 text-emerald-800"
                              : p.inventoryCount > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {p.inventoryCount > 0 ? `${p.inventoryCount} units` : "Out of Stock"}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            p.status === "PUBLISHED"
                              ? "bg-violet-100 text-violet-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-violet-50 hover:text-violet-700 text-slate-600 transition-colors"
                          title="Edit Product"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors"
                          title="Delete Product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── TAB 3: STOCK & INVENTORY MANAGEMENT ────────────────── */}
      {activeTab === "stock" && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Stock & Inventory Controller</h1>
            <p className="text-xs text-slate-500 mt-1">Real-time inventory levels, low-stock threshold alerts, and instant adjustments</p>
          </div>

          {/* Stock Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Units in Stock</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{totalStockUnits}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Across {products.length} active listings</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Healthy Inventory (&gt;5)</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{healthyStockCount}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Sufficient inventory depth</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Low Stock Warnings (1-5)</span>
              <div className="text-2xl font-black text-amber-600 mt-1">{lowStockCount}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Reorder recommended</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Out of Stock (0)</span>
              <div className="text-2xl font-black text-rose-600 mt-1">{outOfStockCount}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Unpurchasable on marketplace</p>
            </div>
          </div>

          {/* Stock Controller Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-2">
                {(["ALL", "HEALTHY", "LOW", "OUT"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setStockFilter(mode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      stockFilter === mode
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {mode === "ALL"
                      ? "All Items"
                      : mode === "HEALTHY"
                      ? "Healthy (>5)"
                      : mode === "LOW"
                      ? "Low Stock (1-5)"
                      : "Out of Stock (0)"}
                  </button>
                ))}
              </div>

              <div className="relative w-64">
                <input
                  type="text"
                  placeholder="Filter stock by name..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-6">Product</th>
                    <th className="py-3 px-6">Current Inventory</th>
                    <th className="py-3 px-6">Status Indicator</th>
                    <th className="py-3 px-6 text-right">Quick Stock Adjustment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-4 px-6 flex items-center space-x-3">
                        <Image
                          src={p.images[0]?.url || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=100&q=80"}
                          alt=""
                          width={36}
                          height={36}
                          unoptimized
                          className="w-9 h-9 rounded-lg object-cover bg-slate-100 flex-shrink-0"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{p.title}</p>
                          <span className="text-[10px] text-slate-400">₹{Number(p.price).toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-base font-black text-slate-900">{p.inventoryCount}</span>
                        <span className="text-[11px] text-slate-400 ml-1">units</span>
                        {quickUpdateId === p.id && (
                          <span className="ml-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                            Updated!
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        {p.inventoryCount > 5 ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>In Stock (Healthy)</span>
                          </span>
                        ) : p.inventoryCount > 0 ? (
                          <span className="inline-flex items-center space-x-1 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>Low Stock Alert</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full font-bold text-[10px]">
                            <X className="w-3 h-3 text-rose-600" />
                            <span>Out of Stock</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right space-x-1.5">
                        <button
                          onClick={() => handleQuickStockUpdate(p.id, p.inventoryCount - 1)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                          title="Reduce 1"
                        >
                          -1
                        </button>
                        <button
                          onClick={() => handleQuickStockUpdate(p.id, p.inventoryCount + 1)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                          title="Add 1"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => handleQuickStockUpdate(p.id, p.inventoryCount + 5)}
                          className="px-2.5 py-1 bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold rounded-lg transition-colors"
                          title="Add 5"
                        >
                          +5
                        </button>
                        <button
                          onClick={() => handleQuickStockUpdate(p.id, p.inventoryCount + 10)}
                          className="px-2.5 py-1 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg transition-colors shadow-xs"
                          title="Add 10"
                        >
                          +10
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── TAB 4: ORDER FULFILLMENT ────────────────── */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Order Fulfillment Queue</h1>
            <p className="text-xs text-slate-500 mt-1">
              Fulfill customer shipments, dispatch tracking numbers, and manage carrier logistics
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-4">
            {/* Filters */}
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-1.5">
                {["ALL", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      orderStatusFilter === st
                        ? "bg-violet-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="relative w-64">
                <input
                  type="text"
                  placeholder="Search by buyer, order ID, tracking..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No orders match your filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-6">Sub-Order Reference</th>
                      <th className="py-3 px-6">Customer & Destination</th>
                      <th className="py-3 px-6">Items Ordered</th>
                      <th className="py-3 px-6">Net Payout</th>
                      <th className="py-3 px-6">Status & Carrier</th>
                      <th className="py-3 px-6 text-right">Fulfillment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/60">
                        <td className="py-4 px-6">
                          <span className="font-mono font-bold text-slate-900">{o.id.substring(0, 10)}...</span>
                          <span className="text-[10px] text-slate-400 block">{new Date(o.createdAt).toLocaleDateString()}</span>
                        </td>
                        <td className="py-4 px-6">
                          <p className="font-bold text-slate-900">{o.order.buyer?.name || "Customer"}</p>
                          <p className="text-[11px] text-slate-500">
                            {getAddressValue(o.order.shippingAddress, "city")},{" "}
                            {getAddressValue(o.order.shippingAddress, "state")}
                          </p>
                        </td>
                        <td className="py-4 px-6 space-y-1">
                          {o.items.map((i) => (
                            <div key={i.id} className="text-[11px] text-slate-700 flex items-center space-x-1.5">
                              <span className="font-bold text-violet-700">{i.quantity}&times;</span>
                              <span className="truncate max-w-[150px]">{i.product.title}</span>
                            </div>
                          ))}
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-bold text-emerald-600 block">₹{Number(o.sellerPayout).toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400">Fee: ₹{Number(o.commissionAmount).toFixed(2)}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              o.status === "DELIVERED"
                                ? "bg-emerald-100 text-emerald-800"
                                : o.status === "SHIPPED"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {o.status}
                          </span>
                          {o.trackingNumber && (
                            <span className="block text-[10px] text-slate-500 font-mono mt-1">
                              {o.carrierName || "Carrier"}: {o.trackingNumber}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => {
                              setSelectedSubOrder(o);
                              setFulfillmentForm({
                                status: getFulfillmentStatus(o.status),
                                trackingNumber: o.trackingNumber || "",
                                carrierName: o.carrierName || "",
                              });
                            }}
                            className="px-3 py-1.5 bg-violet-50 text-violet-700 hover:bg-violet-100 rounded-lg text-xs font-bold transition-colors"
                          >
                            Update Status
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────── TAB 5: SELLER PAYOUT MANAGEMENT ────────────────── */}
      {activeTab === "payouts" && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Merchant Payouts & Disbursal Ledger</h1>
            <p className="text-xs text-slate-500 mt-1">
              Automated split payouts, available balances, and transfer transaction history
            </p>
          </div>

          {/* Payout Balances */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Lifetime Earnings</span>
              <div className="text-2xl font-black text-slate-900">
                ₹{analytics?.summary?.netEarnings?.toFixed(2) || "0.00"}
              </div>
              <p className="text-[11px] text-slate-500">Gross sales minus 10% platform commission</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Pending Transfers</span>
              <div className="text-2xl font-black text-amber-600">
                ₹{analytics?.summary?.pendingPayouts?.toFixed(2) || "0.00"}
              </div>
              <p className="text-[11px] text-slate-500">Awaiting automated batch settlement</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Settled / Transferred</span>
              <div className="text-2xl font-black text-emerald-600">
                ₹{analytics?.summary?.completedPayouts?.toFixed(2) || "0.00"}
              </div>
              <p className="text-[11px] text-slate-500">Disbursed via Stripe Transfer</p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Stripe Account Status</span>
              <div className="flex items-center space-x-1.5 mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-800 text-sm">Direct Deposit Active</span>
              </div>
              <p className="text-[11px] text-slate-500">Payout schedule: Immediate on dispatch</p>
            </div>
          </div>

          {/* Payout Records Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-3">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Payout Transaction Records</h2>
              <span className="text-xs text-slate-400">
                {analytics?.payouts?.length || 0} transfer ledger entries
              </span>
            </div>

            {(!analytics?.payouts || analytics.payouts.length === 0) ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No payout transactions recorded yet. When buyers complete purchases from your store, payouts appear here.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-6">Sub-Order Ref</th>
                      <th className="py-3 px-6">Order Date</th>
                      <th className="py-3 px-6">Gross Subtotal</th>
                      <th className="py-3 px-6">Fee Deducted (10%)</th>
                      <th className="py-3 px-6">Net Payout Amount</th>
                      <th className="py-3 px-6 text-right">Transfer Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60">
                        <td className="py-4 px-6 font-mono font-bold text-slate-900">
                          {p.subOrder?.id?.substring(0, 12)}...
                        </td>
                        <td className="py-4 px-6 text-slate-500">
                          {new Date(p.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-4 px-6 text-slate-800 font-medium">
                          ₹{Number(p.subOrder?.subtotal || 0).toFixed(2)}
                        </td>
                        <td className="py-4 px-6 text-rose-600 font-medium">
                          -₹{Number(p.subOrder?.commissionAmount || 0).toFixed(2)}
                        </td>
                        <td className="py-4 px-6 font-black text-emerald-600">
                          ₹{Number(p.amount).toFixed(2)}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              p.status === "TRANSFERRED"
                                ? "bg-emerald-100 text-emerald-800"
                                : p.status === "PENDING"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────── SUCCESS POPUP: PRODUCT CREATED ────────────────── */}
      {createdProductPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-6 shadow-2xl relative animate-in zoom-in-95">
            <button
              onClick={() => setCreatedProductPopup(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center pt-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-emerald-200">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Product Created Successfully!</h3>
              <p className="text-xs text-slate-500 mt-1">Your new listing has been published and is now live on the marketplace.</p>
            </div>

            {/* Product Snapshot Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center space-x-3.5 text-left">
              <Image
                src={
                  createdProductPopup.images?.[0]?.url ||
                  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=150&q=80"
                }
                alt={createdProductPopup.title || "Product"}
                width={64}
                height={64}
                unoptimized
                className="w-16 h-16 rounded-xl object-cover bg-white border border-slate-200 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-900 text-sm truncate">{createdProductPopup.title}</h4>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="font-black text-violet-700 text-sm">
                    ₹{Number(createdProductPopup.price).toFixed(2)}
                  </span>
                  {createdProductPopup.inventoryCount !== undefined && (
                    <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                      {createdProductPopup.inventoryCount} in stock
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                  /products/{createdProductPopup.slug}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <Link
                href={`/products/${createdProductPopup.slug}`}
                target="_blank"
                className="w-full py-2.5 px-4 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-md shadow-violet-200 transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>View Product on Store</span>
                <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80" />
              </Link>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreatedProductPopup(null);
                    setProductFormError(null);
                    setIsNewProductOpen(true);
                  }}
                  className="flex-1 py-2 px-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs transition-colors flex items-center justify-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Another</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedProductPopup(null)}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── CREATE PRODUCT MODAL ────────────────── */}
      {isNewProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add New Product Listing</h2>
                <p className="text-xs text-slate-500">Your product will be published to the public marketplace catalog</p>
              </div>
              <button
                onClick={() => setIsNewProductOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {productFormError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-start space-x-2.5 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1 font-semibold leading-relaxed">{productFormError}</div>
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={productForm.title}
                  onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                  placeholder="e.g. Minimalist Oak Wireless Charging Pad"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={productForm.categoryId}
                  onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="79.99"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Compare Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={productForm.comparePrice}
                    onChange={(e) => setProductForm({ ...productForm, comparePrice: e.target.value })}
                    placeholder="99.00"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    required
                    value={productForm.inventoryCount}
                    onChange={(e) => setProductForm({ ...productForm, inventoryCount: e.target.value })}
                    placeholder="25"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                  />
                </div>
              </div>

              <ImageUpload
                label="Product Cover Image (Supabase Storage)"
                value={productForm.imageUrl}
                onChange={(url) => setProductForm({ ...productForm, imageUrl: url })}
                required
                folder="products"
                aspectRatio="video"
                helperText="Upload a product photo or switch to enter an image URL"
              />

              <div>
                <label className="block font-bold text-slate-700 mb-1">Detailed Description</label>
                <textarea
                  rows={3}
                  required
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Describe material craftsmanship, technical specs, warranty, dimensions..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="newFeatured"
                  checked={productForm.featured}
                  onChange={(e) => setProductForm({ ...productForm, featured: e.target.checked })}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="newFeatured" className="font-semibold text-slate-700">
                  Feature this product on marketplace homepage
                </label>
              </div>

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewProductOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-md shadow-violet-200"
                >
                  {savingProduct ? "Publishing..." : "Publish Listing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────── EDIT PRODUCT MODAL (FULL EDITING) ────────────────── */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Product Listing</h2>
                <p className="text-xs text-slate-500">Updating ID: {editingProduct.id}</p>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editFormError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl flex items-start space-x-2.5 text-xs animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600 mt-0.5" />
                <div className="flex-1 font-semibold leading-relaxed">{editFormError}</div>
              </div>
            )}

            <form onSubmit={handleUpdateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={editForm.categoryId}
                    onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Listing Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        status: e.target.value as SellerProduct["status"],
                      })
                    }
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-bold"
                  >
                    <option value="PUBLISHED">PUBLISHED (Active on Store)</option>
                    <option value="DRAFT">DRAFT (Hidden from Buyers)</option>
                    <option value="OUT_OF_STOCK">OUT OF STOCK</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editForm.price}
                    onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Compare Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.comparePrice}
                    onChange={(e) => setEditForm({ ...editForm, comparePrice: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Inventory Units</label>
                  <input
                    type="number"
                    required
                    value={editForm.inventoryCount}
                    onChange={(e) => setEditForm({ ...editForm, inventoryCount: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-bold"
                  />
                </div>
              </div>

              <ImageUpload
                label="Product Image (Supabase Storage)"
                value={editForm.imageUrl}
                onChange={(url) => setEditForm({ ...editForm, imageUrl: url })}
                folder="products"
                aspectRatio="video"
                helperText="Upload a new photo to replace current image, or enter an image URL"
              />

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="editFeatured"
                  checked={editForm.featured}
                  onChange={(e) => setEditForm({ ...editForm, featured: e.target.checked })}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="editFeatured" className="font-semibold text-slate-700">
                  Feature this product on homepage
                </label>
              </div>

              <div className="pt-3 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingProduct}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-md shadow-violet-200"
                >
                  {updatingProduct ? "Saving Changes..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────── UPDATE FULFILLMENT MODAL ────────────────── */}
      {selectedSubOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Update Shipment Fulfillment</h2>
                <p className="text-xs text-slate-500">Order ID: {selectedSubOrder.id.substring(0, 10)}...</p>
              </div>
              <button
                onClick={() => setSelectedSubOrder(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateFulfillment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Fulfillment Status</label>
                <select
                  value={fulfillmentForm.status}
                  onChange={(e) =>
                    setFulfillmentForm({
                      ...fulfillmentForm,
                      status: e.target.value as "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED",
                    })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-bold"
                >
                  <option value="PROCESSING">Processing at Warehouse</option>
                  <option value="SHIPPED">Shipped (In Transit)</option>
                  <option value="DELIVERED">Delivered to Buyer</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Carrier Name</label>
                <input
                  type="text"
                  value={fulfillmentForm.carrierName}
                  onChange={(e) =>
                    setFulfillmentForm({ ...fulfillmentForm, carrierName: e.target.value })
                  }
                  placeholder="e.g. FedEx Express, DHL, USPS, UPS"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tracking Number</label>
                <input
                  type="text"
                  value={fulfillmentForm.trackingNumber}
                  onChange={(e) =>
                    setFulfillmentForm({ ...fulfillmentForm, trackingNumber: e.target.value })
                  }
                  placeholder="e.g. TRK-98234821-US"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedSubOrder(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingFulfillment}
                  className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-md shadow-violet-200"
                >
                  {updatingFulfillment ? "Updating..." : "Save Tracking Info"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SellerDashboardPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-500">Loading Seller Portal...</div>}>
      <SellerDashboardContent />
    </Suspense>
  );
}
