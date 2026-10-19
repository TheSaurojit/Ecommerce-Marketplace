"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useWishlist } from "@/context/wishlist-context";
import { useCart } from "@/context/cart-context";
import type { WishlistItem } from "@/context/wishlist-context";
import {
  Heart,
  ShoppingBag,
  Trash2,
  Store,
  ArrowRight,
  Check,
} from "lucide-react";

export default function WishlistPage() {
  const { items, count, removeItem, clearWishlist } = useWishlist();
  const { addItem } = useCart();
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});

  const handleMoveToCart = (item: WishlistItem) => {
    addItem(
      {
        productId: item.id,
        title: item.title,
        slug: item.slug,
        price: item.price,
        imageUrl: item.imageUrl,
        sellerId: item.sellerId,
        storeName: item.storeName,
      },
      1
    );

    setAddedMap((prev) => ({ ...prev, [item.id]: true }));
    setTimeout(() => {
      setAddedMap((prev) => ({ ...prev, [item.id]: false }));
    }, 1500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Heart className="w-5 h-5 fill-rose-600" />
            </div>
            <span>My Saved Wishlist</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {count === 0
              ? "Keep track of items you love and move them directly to checkout"
              : `${count} item${count === 1 ? "" : "s"} saved for later purchase`}
          </p>
        </div>

        {count > 0 && (
          <button
            onClick={clearWishlist}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors w-fit"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Wishlist</span>
          </button>
        )}
      </div>

      {/* Content */}
      {count === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 sm:p-16 text-center space-y-4 max-w-lg mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto shadow-inner">
            <Heart className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Your Wishlist is Empty</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Explore thousands of unique products from verified merchants and click the heart icon
              to save your favorites.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center space-x-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs rounded-xl shadow-md shadow-violet-200 transition-all hover:scale-105"
          >
            <span>Explore Marketplace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {items.map((item) => {
            const isAdded = !!addedMap[item.id];

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-lg hover:shadow-violet-100 transition-all duration-200 flex flex-col group"
              >
                {/* Thumbnail */}
                <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 25vw"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <button
                    onClick={() => removeItem(item.id)}
                    title="Remove from wishlist"
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-xs text-slate-400 hover:text-rose-600 hover:bg-white flex items-center justify-center shadow-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    {item.storeName && (
                      <div className="flex items-center space-x-1 text-[11px] font-semibold text-violet-600 mb-1">
                        <Store className="w-3 h-3" />
                        <span className="truncate">{item.storeName}</span>
                      </div>
                    )}
                    <Link
                      href={`/products/${item.slug}`}
                      className="text-xs font-bold text-slate-900 hover:text-violet-600 transition-colors line-clamp-2 leading-snug"
                    >
                      {item.title}
                    </Link>
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline space-x-1.5">
                        <span className="text-base font-black text-slate-900">
                          ₹{Number(item.price).toFixed(2)}
                        </span>
                        {item.comparePrice && item.comparePrice > item.price && (
                          <span className="text-xs text-slate-400 line-through">
                            ₹{Number(item.comparePrice).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        In Stock
                      </span>
                    </div>

                    <button
                      onClick={() => handleMoveToCart(item)}
                      className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-xs ${
                        isAdded
                          ? "bg-emerald-600 text-white shadow-emerald-200"
                          : "bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200 hover:scale-[1.02]"
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Added to Cart!</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5" />
                          <span>Move to Cart</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
