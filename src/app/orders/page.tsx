"use client";

import React, { useCallback, useEffect, useState, startTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import {
  Package,
  Store,
  Truck,
  CheckCircle2,
  ExternalLink,
  ShoppingBag,
  RotateCw,
  XCircle,
  Radio,
  Sparkles,
} from "lucide-react";
import { client } from "@/lib/rpc";
import { useRealtimeSubscription } from "@/hooks/use-realtime";

interface BuyerOrderItem {
  id: string;
  quantity: number;
  unitPrice: string | number;
  product: {
    slug: string;
    title: string;
    images: { url: string }[];
  };
}

interface BuyerSubOrder {
  id: string;
  status: string;
  subtotal: string | number;
  trackingNumber: string | null;
  carrierName: string | null;
  seller: { storeName: string; storeSlug: string };
  items: BuyerOrderItem[];
}

interface BuyerOrder {
  id: string;
  createdAt: string;
  totalAmount: string | number;
  paymentStatus: string;
  subOrders: BuyerSubOrder[];
}

export default function BuyerOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);
  const [realtimeNotification, setRealtimeNotification] = useState<string | null>(null);

  useRealtimeSubscription({
    topics: [user?.id ? `buyer:orders:${user.id}` : null],
    enabled: Boolean(user?.id),
    onEvent: (event, data) => {
      const payload = (data.payload || data) as Record<string, unknown>;

      if (event === "order:status_updated") {
        const subOrderId = payload.subOrderId as string;
        const status = payload.status as string;
        const trackingNumber = payload.trackingNumber as string | undefined;
        const carrierName = payload.carrierName as string | undefined;

        setOrders((prev) =>
          prev.map((order) => ({
            ...order,
            subOrders: order.subOrders.map((so) =>
              so.id === subOrderId
                ? {
                    ...so,
                    status,
                    trackingNumber: trackingNumber ?? so.trackingNumber,
                    carrierName: carrierName ?? so.carrierName,
                  }
                : so
            ),
          }))
        );

        setRealtimeNotification(
          `Shipment #${subOrderId?.slice(0, 8)} status updated to "${status}"${
            trackingNumber ? ` via ${carrierName || "Carrier"} (Tracking: ${trackingNumber})` : ""
          }`
        );
        setTimeout(() => setRealtimeNotification(null), 8000);
      } else if (event === "order:paid") {
        const orderId = payload.orderId as string;
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, paymentStatus: "PAID" } : order
          )
        );
        setRealtimeNotification("Order payment confirmed via Stripe!");
        setTimeout(() => setRealtimeNotification(null), 6000);
      }
    },
  });

  const fetchOrders = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await client.api.orders["my-orders"].$get();
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCancelSubOrder = async (subOrderId: string) => {
    if (!confirm("Are you sure you want to cancel this vendor shipment? If paid, a refund will be processed to your card.")) {
      return;
    }

    setCancellingId(subOrderId);
    try {
      const res = await client.api.orders.cancel[":id"].$post({
        param: { id: subOrderId },
      });

      if (res.ok) {
        const data = await res.json();
        setCancelMessage(data.message || "Shipment successfully cancelled.");
        await fetchOrders(false);
      } else {
        const data = await res.json();
        alert("error" in data ? data.error : "Failed to cancel shipment");
      }
    } catch {
      alert("Error processing shipment cancellation");
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    startTransition(() => {
      if (!authLoading && user?.id) {
        void fetchOrders();
      } else if (!authLoading && !user) {
        setLoading(false);
      }
    });
  }, [authLoading, user, fetchOrders]);

  const getStatusStep = (status: string) => {
    switch (status) {
      case "PROCESSING":
        return 2;
      case "SHIPPED":
        return 3;
      case "DELIVERED":
        return 4;
      default:
        return 1;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-gray-200 gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
            <Package className="w-6 h-6 text-indigo-600" />
            <span>My Orders & Shipments</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Real-time fulfillment tracking and itemized receipts partitioned by merchant store
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Live Tracking Active</span>
          </div>

          <button
            onClick={() => fetchOrders(true)}
            disabled={loading}
            className="inline-flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors shadow-xs"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh Tracking</span>
          </button>
        </div>
      </div>

      {realtimeNotification && (
        <div className="p-4 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 text-indigo-900 text-xs font-semibold rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-indigo-950 block">Real-Time Dispatch Notification</span>
              <span className="text-indigo-700 text-[11px]">{realtimeNotification}</span>
            </div>
          </div>
          <button
            onClick={() => setRealtimeNotification(null)}
            className="text-indigo-400 hover:text-indigo-600 text-xs font-bold px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {cancelMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{cancelMessage}</span>
          </div>
          <button
            onClick={() => setCancelMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-gray-500">Loading your orders...</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4">
          <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-base font-semibold text-gray-900">No orders placed yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Once you make a purchase, individual sub-orders from each vendor with tracking timelines
            will appear right here.
          </p>
          <Link
            href="/products"
            className="inline-block mt-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold text-xs rounded-xl shadow-sm hover:bg-indigo-700"
          >
            Explore Marketplace
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
            >
              {/* Order Header */}
              <div className="bg-gray-50/80 px-6 py-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Order ID: </span>
                  <span className="font-mono font-bold text-gray-900">{order.id}</span>
                  <span className="text-gray-400 mx-2">•</span>
                  <span className="text-gray-500">
                    Placed {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center space-x-4">
                  <div>
                    <span className="text-gray-500">Total Paid: </span>
                    <span className="font-bold text-indigo-600 text-sm">
                      ₹{Number(order.totalAmount).toFixed(2)}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                      order.paymentStatus === "CANCELLED"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {order.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Sub-Orders Partitioned by Vendor */}
              <div className="p-6 space-y-6">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Vendor Shipments ({order.subOrders.length} Sellers)
                </div>

                {order.subOrders.map((sub) => {
                  const step = getStatusStep(sub.status);
                  const isCancelled = sub.status === "CANCELLED" || sub.status === "REFUNDED";

                  return (
                    <div
                      key={sub.id}
                      className="border border-gray-200 rounded-xl p-5 space-y-5 bg-white shadow-xs"
                    >
                      {/* Seller & Subtotal */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-100 gap-2">
                        <div className="flex items-center space-x-2">
                          <Store className="w-4 h-4 text-indigo-600" />
                          <span className="text-sm font-bold text-gray-900">
                            {sub.seller.storeName}
                          </span>
                          <Link
                            href={`/stores/${sub.seller.storeSlug}`}
                            className="text-xs text-indigo-600 hover:underline flex items-center space-x-0.5"
                          >
                            <span>Visit Store</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>

                        <div className="flex items-center space-x-3 text-xs">
                          <span className="text-gray-500">Subtotal: ₹{Number(sub.subtotal).toFixed(2)}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${
                              sub.status === "DELIVERED"
                                ? "bg-emerald-100 text-emerald-800"
                                : sub.status === "SHIPPED"
                                ? "bg-blue-100 text-blue-800"
                                : sub.status === "CANCELLED"
                                ? "bg-rose-100 text-rose-800"
                                : sub.status === "REFUNDED"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {sub.status}
                          </span>

                          {sub.status === "PROCESSING" && (
                            <button
                              onClick={() => handleCancelSubOrder(sub.id)}
                              disabled={cancellingId === sub.id}
                              className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition-colors disabled:opacity-50"
                            >
                              {cancellingId === sub.id ? "Cancelling..." : "Cancel Shipment"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Items in this sub-order */}
                      <div className="space-y-3">
                        {sub.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-3">
                              {item.product.images[0]?.url ? (
                                <Image
                                  src={item.product.images[0].url}
                                  alt=""
                                  width={40}
                                  height={40}
                                  unoptimized
                                  className="w-10 h-10 rounded-lg object-cover bg-gray-100"
                                />
                              ) : null}
                              <div>
                                <Link
                                  href={`/products/${item.product.slug}`}
                                  className="font-medium text-gray-900 hover:text-indigo-600"
                                >
                                  {item.product.title}
                                </Link>
                                <span className="text-gray-400 block text-[11px]">
                                  Qty: {item.quantity} &times; ₹{Number(item.unitPrice).toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <span className="font-semibold text-gray-800">
                              ₹{(Number(item.unitPrice) * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Delivery Stepper Tracker or Cancelled/Refunded Notice */}
                      {isCancelled ? (
                        <div
                          className={`p-4 rounded-xl flex items-center space-x-3 text-xs ${
                            sub.status === "REFUNDED"
                              ? "bg-purple-50/80 border border-purple-200 text-purple-800"
                              : "bg-rose-50/80 border border-rose-200 text-rose-800"
                          }`}
                        >
                          <XCircle
                            className={`w-5 h-5 flex-shrink-0 ${
                              sub.status === "REFUNDED" ? "text-purple-600" : "text-rose-600"
                            }`}
                          />
                          <div>
                            <span className="font-bold">
                              {sub.status === "REFUNDED" ? "Shipment Refunded:" : "Shipment Cancelled:"}
                            </span>{" "}
                            {sub.status === "REFUNDED"
                              ? "A refund has been issued to your payment method and inventory was restored."
                              : "Stock for these items was returned to the merchant inventory."}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                            <span className="flex items-center space-x-1.5">
                              <Truck className="w-4 h-4 text-indigo-600" />
                              <span>Delivery Progress Timeline</span>
                            </span>
                            {sub.trackingNumber && (
                              <span className="font-mono text-indigo-600">
                                Carrier: {sub.carrierName || "Expedited Express"} • Track #{sub.trackingNumber}
                              </span>
                            )}
                          </div>

                          {/* Visual Progress Bar */}
                          <div className="relative flex items-center justify-between pt-2">
                            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 -translate-y-1/2 z-0" />
                            <div
                              className="absolute top-1/2 left-0 h-1 bg-indigo-600 -translate-y-1/2 transition-all duration-500 z-0"
                              style={{
                                width:
                                  step === 1 ? "0%" : step === 2 ? "33%" : step === 3 ? "66%" : "100%",
                              }}
                            />

                            {[
                              { label: "Order Placed", stepNum: 1 },
                              { label: "Processing", stepNum: 2 },
                              { label: "Shipped", stepNum: 3 },
                              { label: "Delivered", stepNum: 4 },
                            ].map((s) => {
                              const isPassed = step >= s.stepNum;
                              return (
                                <div
                                  key={s.stepNum}
                                  className="relative z-10 flex flex-col items-center"
                                >
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-xs ${
                                      isPassed
                                        ? "bg-indigo-600 text-white"
                                        : "bg-white border-2 border-gray-300 text-gray-400"
                                    }`}
                                  >
                                    {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.stepNum}
                                  </div>
                                  <span
                                    className={`text-[10px] font-semibold mt-1 ${
                                      isPassed ? "text-indigo-900" : "text-gray-400"
                                    }`}
                                  >
                                    {s.label}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
