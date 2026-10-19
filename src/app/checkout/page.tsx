"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";
import {
  CreditCard,
  ShieldCheck,
  Store,
  Truck,
  Lock,
  ArrowLeft,
  AlertCircle,
  Info,
  Loader2,
} from "lucide-react";
import { client } from "@/lib/rpc";

function CheckoutContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { items, groupedBySeller, totalAmount, clearCart } = useCart();

  const isCancelled = searchParams.get("cancelled") === "true";
  const cancelledOrderId = searchParams.get("order_id");

  const [shippingAddress, setShippingAddress] = useState({
    fullName: user?.name || "",
    addressLine: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });

  const [cancellationNotice, setCancellationNotice] = useState<string | null>(null);

  // If user was redirected back after cancelling Stripe Checkout
  useEffect(() => {
    if (!isCancelled || !cancelledOrderId) {
      return;
    }

    let active = true;
    const cancelCheckout = async () => {
      try {
        const response = await client.api.orders["cancel-checkout"].$post({
          json: { orderId: cancelledOrderId },
        });
        const data = await response.json();

        if (!active) return;

        if (response.ok && "success" in data && data.success) {
          setCancellationNotice(
            "You cancelled your Stripe payment session. The reservation was released and inventory restored."
          );
        } else if ("error" in data && typeof data.error === "string") {
          setCancellationNotice(data.error);
        } else {
          setCancellationNotice("Checkout cancellation could not be confirmed. Check your order status.");
        }
      } catch (err: unknown) {
        console.error("Error cancelling pending checkout:", err);
        if (active) {
          setCancellationNotice("Checkout cancellation could not be confirmed. Check your order status.");
        }
      }
    };

    void cancelCheckout();
    return () => {
      active = false;
    };
  }, [isCancelled, cancelledOrderId]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    setLoading(true);
    setError("");

    try {
      const res = await client.api.orders.checkout.$post({
        json: {
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          shippingAddress: {
            ...shippingAddress,
            fullName: shippingAddress.fullName || user?.name || "",
          },
        },
      });

      const data = await res.json();

      if (res.ok && "checkoutUrl" in data && data.checkoutUrl) {
        clearCart();
        window.location.href = data.checkoutUrl;
      } else {
        setError("error" in data && typeof data.error === "string" ? data.error : "Failed to initiate payment session");
      }
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Your shopping bag is empty</h2>
        <p className="text-sm text-gray-500">Add products to your cart before proceeding to checkout.</p>
        {cancellationNotice && (
          <p className="text-sm text-amber-700" role="status">{cancellationNotice}</p>
        )}
        <Link
          href="/products"
          className="inline-block mt-4 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl text-sm"
        >
          Explore Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top back button */}
      <Link
        href="/products"
        className="inline-flex items-center space-x-1.5 text-xs font-semibold text-gray-500 hover:text-indigo-600 mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to shopping</span>
      </Link>

      {cancellationNotice && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>{cancellationNotice}</span>
          </div>
          <button
            onClick={() => setCancellationNotice(null)}
            className="text-amber-600 hover:text-amber-800 font-bold ml-4"
          >
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left: Shipping & Stripe Payment Form */}
        <div className="lg:col-span-7 space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Checkout & Fulfillment</h1>
            <p className="text-xs text-gray-500 mt-1">
              Provide delivery details to complete your multi-vendor purchase
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmitOrder} className="space-y-8">
            {/* 1. Shipping Address */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center space-x-2 pb-3 border-b border-gray-100">
                <Truck className="w-5 h-5 text-indigo-600" />
                <h2 className="text-sm font-bold text-gray-900">1. Shipping Destination</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John Doe"
                    value={shippingAddress.fullName || user?.name || ""}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, fullName: e.target.value })
                    }
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">Street Address</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 123 Main Street, Apt 4B"
                    value={shippingAddress.addressLine}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, addressLine: e.target.value })
                    }
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. San Francisco"
                    value={shippingAddress.city}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, city: e.target.value })
                    }
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">State / Province</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. California"
                    value={shippingAddress.state}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, state: e.target.value })
                    }
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Postal / Zip Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 94103"
                    value={shippingAddress.postalCode}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, postalCode: e.target.value })
                    }
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. United States"
                    value={shippingAddress.country}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, country: e.target.value })
                    }
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. Stripe Payment Section */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-sm font-bold text-gray-900">2. Stripe Secure Payment</h2>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                  Stripe Checkout
                </span>
              </div>

              {/* Stripe Payment Gateway Preview */}
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-400">
                  <span>Encrypted 256-bit Payment</span>
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-sm text-slate-200 font-medium">
                  Hosted Checkout via Stripe
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Credit / Debit Cards, Apple Pay, Google Pay</span>
                  <span className="text-emerald-400 font-semibold">SSL Secured</span>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 space-y-1">
                <div className="flex items-center space-x-1 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Automated Marketplace Split Details:</span>
                </div>
                <p className="text-[11px] text-indigo-700 leading-relaxed">
                  Upon placement, this single transaction will be automatically split into individual
                  sub-orders. Platform fees (10%) are automatically calculated and logged, while remaining
                  net payouts are routed to each vendor&apos;s pending account.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center space-x-2 disabled:bg-gray-200 disabled:text-gray-400"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing Secure Checkout...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pay ₹{totalAmount.toFixed(2)} with Stripe</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right: Order Decomposition Summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-6 sticky top-24">
            <h2 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-100">
              Multi-Vendor Order Decomposition
            </h2>

            {/* Groups */}
            <div className="space-y-4">
              {groupedBySeller.map((group) => (
                <div
                  key={group.sellerId}
                  className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50"
                >
                  <div className="bg-gray-100/70 px-4 py-2 border-b border-gray-200 flex items-center justify-between text-xs font-semibold text-gray-800">
                    <div className="flex items-center space-x-1.5">
                      <Store className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{group.storeName}</span>
                    </div>
                    <span>Subtotal: ₹{group.subtotal.toFixed(2)}</span>
                  </div>

                  <div className="p-3 divide-y divide-gray-100 bg-white">
                    {group.items.map((item) => (
                      <div key={item.productId} className="py-2.5 first:pt-0 last:pb-0 flex space-x-3">
                        {item.imageUrl && (
                          <Image
                            src={item.imageUrl}
                            alt=""
                            width={48}
                            height={48}
                            unoptimized
                            className="w-12 h-12 rounded-lg object-cover bg-gray-100"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{item.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Qty: {item.quantity} &times; ₹{item.price.toFixed(2)}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-gray-900">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Vendor Fee Transparency */}
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-[11px] text-gray-500 flex justify-between">
                    <span>Platform Commission (10%):</span>
                    <span>₹{(group.subtotal * 0.1).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Calculation */}
            <div className="border-t border-gray-100 pt-4 space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Total Items</span>
                <span className="font-semibold text-gray-900">{items.reduce((s, i) => s + i.quantity, 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping ({groupedBySeller.length} vendors)</span>
                <span className="text-emerald-600 font-semibold">Free</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between items-baseline text-base font-bold text-gray-900">
                <span>Total Charge</span>
                <span className="text-2xl text-indigo-600 font-extrabold">
                  ₹{totalAmount.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
