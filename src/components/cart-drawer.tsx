"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/cart-context";
import { X, Trash2, ShoppingBag, ArrowRight, Store, Minus, Plus } from "lucide-react";

export function CartDrawer() {
  const { isOpen, setIsOpen, groupedBySeller, totalAmount, updateQuantity, removeItem, itemCount } =
    useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-8 sm:pl-16">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col rounded-l-3xl overflow-hidden">

          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-violet-950 to-violet-900 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-violet-300" />
              <h2 className="text-base font-black text-white">
                Cart
                <span className="ml-2 text-xs font-bold bg-violet-700 text-violet-200 px-2 py-0.5 rounded-full">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </span>
              </h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-violet-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50">
            {groupedBySeller.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                  <ShoppingBag className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-base font-bold text-slate-700">Your cart is empty</p>
                <p className="text-sm text-slate-400 mt-1 max-w-[200px]">
                  Discover products from independent stores
                </p>
                <button
                  onClick={() => setIsOpen(false)}
                  className="mt-6 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-violet-200 transition-colors"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              groupedBySeller.map((group) => (
                <div
                  key={group.sellerId}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                >
                  {/* Seller header */}
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <Store className="w-3.5 h-3.5 text-violet-500" />
                      <span>
                        Sold by <strong className="text-slate-800">{group.storeName}</strong>
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500">
                      ₹{group.subtotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-slate-50">
                    {group.items.map((item) => (
                      <div key={item.productId} className="p-4 flex gap-3">
                        <Image
                          src={item.imageUrl}
                          alt={item.title}
                          width={64}
                          height={64}
                          unoptimized
                          className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-slate-100"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-slate-900 line-clamp-1">
                            {item.title}
                          </h4>
                          <p className="text-sm font-black text-violet-700 mt-0.5">
                            ₹{item.price.toFixed(2)}
                          </p>

                          <div className="flex items-center justify-between mt-2.5">
                            {/* Qty controls */}
                            <div className="flex items-center gap-0 border border-slate-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                className="px-2.5 py-1 text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-3 py-1 text-xs font-black text-slate-800 bg-slate-50 border-x border-slate-200">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                className="px-2.5 py-1 text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <button
                              onClick={() => removeItem(item.productId)}
                              className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {groupedBySeller.length > 0 && (
            <div className="border-t border-slate-100 p-5 space-y-4 bg-white flex-shrink-0">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Shipping from {groupedBySeller.length} store{groupedBySeller.length > 1 ? "s" : ""}</span>
                <span className="text-emerald-600 font-bold">Free Delivery</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Total</span>
                <span className="text-2xl font-black text-violet-700">₹{totalAmount.toFixed(2)}</span>
              </div>

              <Link
                href="/checkout"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white font-black rounded-xl shadow-md shadow-violet-200/60 transition-all"
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
