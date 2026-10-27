"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star, Store, Plus, Check, Flame, Heart } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";

export interface ProductCardProps {
  product: {
    id: string;
    title: string;
    slug: string;
    description: string;
    price: number;
    comparePrice?: number | null;
    inventoryCount: number;
    featured?: boolean;
    images: { url: string; altText?: string | null }[];
    category?: { name: string; slug: string };
    seller: {
      id: string;
      storeName: string;
      storeSlug: string;
      logoUrl?: string | null;
    };
    avgRating?: number;
    ratingCount?: number;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const { isInWishlist, toggleItem } = useWishlist();
  const [added, setAdded] = useState(false);

  const mainImage =
    product.images[0]?.url ||
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80";

  const isFavorite = isInWishlist(product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    addItem(
      {
        productId: product.id,
        title: product.title,
        slug: product.slug,
        price: product.price,
        imageUrl: mainImage,
        sellerId: product.seller.id,
        storeName: product.seller.storeName,
      },
      1
    );

    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    toggleItem({
      id: product.id,
      title: product.title,
      slug: product.slug,
      price: product.price,
      comparePrice: product.comparePrice,
      imageUrl: mainImage,
      sellerId: product.seller.id,
      storeName: product.seller.storeName,
      storeSlug: product.seller.storeSlug,
      inStock: product.inventoryCount > 0,
    });
  };

  const discountPercent =
    product.comparePrice && product.comparePrice > product.price
      ? Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100)
      : null;

  const isOutOfStock = product.inventoryCount <= 0;

  return (
    <div className="group relative bg-white rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgba(109,71,200,0.14),0_0_0_1px_rgba(109,71,200,0.08)] hover:-translate-y-1 transition-all duration-300 flex flex-col">

      {/* Image */}
      <Link href={`/products/${product.slug}`} className="relative aspect-[4/3] overflow-hidden bg-slate-100 block">
        <Image
          src={mainImage}
          alt={product.title}
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 25vw"
          className="w-full h-full object-cover object-center group-hover:scale-[1.04] transition-transform duration-500"
        />

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {product.featured && (
            <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md shadow-sm">
              <Flame className="w-3 h-3" />
              Featured
            </span>
          )}
          {discountPercent && (
            <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-sm">
              −{discountPercent}%
            </span>
          )}
        </div>

        {/* Wishlist Heart Button */}
        <button
          type="button"
          onClick={handleToggleWishlist}
          title={isFavorite ? "Remove from wishlist" : "Add to wishlist"}
          className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-sm backdrop-blur-xs ${
            isFavorite
              ? "bg-rose-500 text-white shadow-rose-200 scale-105"
              : "bg-white/80 text-slate-600 hover:bg-white hover:text-rose-500 hover:scale-105"
          }`}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? "fill-white" : ""}`} />
        </button>

        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-lg">
              Out of Stock
            </span>
          </div>
        )}
      </Link>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Store link */}
        <Link
          href={`/stores/${product.seller.storeSlug}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-600 hover:text-violet-800 transition-colors mb-2 w-fit"
        >
          <Store className="w-3 h-3" />
          {product.seller.storeName}
        </Link>

        {/* Title */}
        <Link href={`/products/${product.slug}`} className="flex-1">
          <h3 className="text-sm font-semibold text-slate-800 group-hover:text-violet-700 transition-colors line-clamp-2 leading-snug">
            {product.title}
          </h3>
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-1.5 mt-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={`w-3 h-3 ${
                product.avgRating && s <= Math.round(product.avgRating)
                  ? "fill-amber-400 text-amber-400"
                  : "text-slate-200 fill-slate-200"
              }`}
            />
          ))}
          <span className="text-[11px] font-semibold text-slate-700 ml-0.5">
            {product.avgRating ? product.avgRating.toFixed(1) : "New"}
          </span>
          {product.ratingCount ? (
            <span className="text-[11px] text-slate-400">({product.ratingCount})</span>
          ) : null}
        </div>

        {/* Price & CTA */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-end justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-slate-900">
                ₹{product.price.toFixed(2)}
              </span>
              {product.comparePrice && (
                <span className="text-xs text-slate-400 line-through">
                  ₹{product.comparePrice.toFixed(2)}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] font-semibold ${
                isOutOfStock ? "text-rose-500" : "text-emerald-600"
              }`}
            >
              {isOutOfStock ? "Unavailable" : `${product.inventoryCount} in stock`}
            </span>
          </div>

          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            title={isOutOfStock ? "Out of stock" : "Add to cart"}
            className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 shadow-sm ${
              added
                ? "bg-emerald-500 text-white shadow-emerald-200"
                : isOutOfStock
                ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                : "bg-violet-600 hover:bg-violet-700 text-white shadow-violet-200 hover:shadow-violet-300 hover:scale-105"
            }`}
          >
            {added ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
