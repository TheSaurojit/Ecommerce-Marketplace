"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { client } from "@/lib/rpc";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Store,
  Package,
  ArrowRight,
  ShieldCheck,
  Truck,
} from "lucide-react";

type ConfirmationResponse = Awaited<
  ReturnType<typeof client.api.orders["confirm-payment"]["$post"]>
>;
type ConfirmationBody = Awaited<ReturnType<ConfirmationResponse["json"]>>;
type ConfirmedOrder = Extract<ConfirmationBody, { order: unknown }>["order"];

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const orderId = searchParams.get("order_id");
  const hasPaymentReference = Boolean(orderId && sessionId);
  const [loading, setLoading] = useState(hasPaymentReference);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<ConfirmedOrder | null>(null);
  const confirmedRef = useRef(false);

  useEffect(() => {
    if (!orderId || !sessionId) {
      return;
    }

    // Guard against duplicate / infinite execution
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    const confirmPayment = async () => {
      try {
        const res = await client.api.orders["confirm-payment"].$post({
          json: {
            sessionId,
            orderId,
          },
        });

        const data = await res.json();

        if (res.ok && "order" in data) {
          setOrder(data.order);
        } else if ("error" in data) {
          setError(typeof data.error === "string" ? data.error : "Payment verification failed.");
        } else {
          setError("Failed to verify payment status.");
        }
      } catch (err: unknown) {
        console.error("Payment confirmation error:", err);
        setError("Network error while verifying payment. If you were charged, your order will update shortly.");
      } finally {
        setLoading(false);
      }
    };

    confirmPayment();
  }, [sessionId, orderId]);

  const paymentError =
    error ?? (!hasPaymentReference ? "Missing Stripe payment reference or checkout session ID." : null);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-6">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Verifying Payment...</h1>
          <p className="text-sm text-gray-500">
            Securely confirming your Stripe transaction and notifying marketplace merchants.
          </p>
        </div>
      </div>
    );
  }

  if (paymentError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Payment Notice</h1>
          <p className="text-sm text-gray-600 max-w-md mx-auto">{paymentError}</p>
        </div>
        <div className="pt-4 flex justify-center gap-4">
          <Link
            href="/orders"
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl shadow-sm"
          >
            Check My Orders
          </Link>
          <Link
            href="/checkout"
            className="px-6 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-xl shadow-sm"
          >
            Return to Checkout
          </Link>
        </div>
      </div>
    );
  }

  const subOrders = order?.subOrders ?? [];
  const totalAmount = Number(order?.totalAmount || 0);
  const shippingAddress = order?.shippingAddress;
  const addressValue = (key: string) => {
    if (!shippingAddress || typeof shippingAddress !== "object" || Array.isArray(shippingAddress)) {
      return "";
    }

    const value = shippingAddress[key];
    return typeof value === "string" ? value : "";
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Payment Verified & Dispatched
          </span>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Payment Successful!</h1>
          <p className="text-sm text-gray-600 mt-2 max-w-lg mx-auto">
            Thank you for your purchase. We have decomposed your transaction into individual orders
            and notified {subOrders.length} {subOrders.length === 1 ? "merchant" : "merchants"} for fulfillment.
          </p>
        </div>
      </div>

      {/* Order Info Card */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100 text-sm">
          <div>
            <span className="text-xs text-gray-500 font-medium">Order Reference</span>
            <p className="font-mono font-bold text-indigo-600 text-base">{order?.id || orderId}</p>
          </div>
          <div className="sm:text-right">
            <span className="text-xs text-gray-500 font-medium">Total Paid</span>
            <p className="font-extrabold text-gray-900 text-xl">₹{totalAmount.toFixed(2)}</p>
          </div>
        </div>

        {/* Vendor Sub-orders Breakdown */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-indigo-600" />
            Shipment Decomposition ({subOrders.length} {subOrders.length === 1 ? "Package" : "Packages"})
          </h2>

          <div className="space-y-3">
            {subOrders.map((sub) => (
              <div
                key={sub.id}
                className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/40"
              >
                <div className="bg-gray-100/70 px-4 py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <Store className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-gray-900">{sub.seller?.storeName || "Vendor"}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <Truck className="w-3 h-3" />
                    {sub.status || "PROCESSING"}
                  </span>
                </div>

                <div className="p-3 divide-y divide-gray-100 bg-white">
                  {sub.items?.map((item) => (
                    <div key={item.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        {item.product?.images?.[0]?.url && (
                          <Image
                            src={item.product.images[0].url}
                            alt=""
                            width={40}
                            height={40}
                            unoptimized
                            className="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-200"
                          />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-[200px] sm:max-w-xs">
                            {item.product?.title || "Product"}
                          </p>
                          <p className="text-gray-500 text-[11px]">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900">
                        ₹{(Number(item.unitPrice) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shipping Destination Summary */}
        {shippingAddress && typeof shippingAddress === "object" && !Array.isArray(shippingAddress) && (
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-600 space-y-1">
            <span className="font-bold text-gray-900 block">Shipping Destination</span>
            <p className="text-gray-700">
              {addressValue("fullName") && <span>{addressValue("fullName")} &bull; </span>}
              {addressValue("addressLine")}, {addressValue("city")},{" "}
              {addressValue("state")} {addressValue("postalCode")},{" "}
              {addressValue("country")}
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
        <Link
          href="/orders"
          className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-indigo-100 flex items-center justify-center space-x-2"
        >
          <span>Track Orders & Deliveries</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          href="/products"
          className="px-6 py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-xl shadow-sm flex items-center justify-center"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto px-4 py-24 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
