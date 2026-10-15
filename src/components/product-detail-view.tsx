"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/context/cart-context";
import { useAuth } from "@/context/auth-context";
import { useWishlist } from "@/context/wishlist-context";
import {
  Star,
  Store,
  ShieldCheck,
  ShoppingBag,
  Check,
  Truck,
  MessageSquare,
  Heart,
} from "lucide-react";
import { client } from "@/lib/rpc";

interface ProductDetailProps {
  product: {
    id: string;
    title: string;
    slug: string;
    description: string;
    price: number;
    comparePrice?: number | null;
    inventoryCount: number;
    images: { url: string; altText?: string | null }[];
    category?: { name: string; slug: string };
    seller: {
      id: string;
      storeName: string;
      storeSlug: string;
      description?: string | null;
      logoUrl?: string | null;
      bannerUrl?: string | null;
    };
    reviews: {
      id: string;
      rating: number;
      comment: string | null;
      createdAt: Date;
      buyer: { name: string | null };
    }[];
  };
}

export function ProductDetailView({ product }: ProductDetailProps) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const { isInWishlist, toggleItem } = useWishlist();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const inWishlist = isInWishlist(product.id);

  // Review Form State
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewsList, setReviewsList] = useState(product.reviews);
  const [reviewMessage, setReviewMessage] = useState("");

  const ratingCount = reviewsList.length;
  const avgRating =
    ratingCount > 0
      ? Number((reviewsList.reduce((acc, r) => acc + r.rating, 0) / ratingCount).toFixed(1))
      : 0;

  const currentImg = product.images[selectedImage]?.url || "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80";

  const handleAddToCart = () => {
    addItem(
      {
        productId: product.id,
        title: product.title,
        slug: product.slug,
        price: product.price,
        imageUrl: currentImg,
        sellerId: product.seller.id,
        storeName: product.seller.storeName,
      },
      quantity
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setReviewSubmitting(true);
    try {
      const res = await client.api.reviews.$post({
        json: {
          productId: product.id,
          rating,
          comment,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if ("review" in data) {
          setReviewsList((prev) => [
            {
              id: data.review.id,
              rating: data.review.rating,
              comment: data.review.comment,
              createdAt: new Date(),
              buyer: { name: user?.name || "Verified Buyer" },
            },
            ...prev,
          ]);
          setComment("");
          setReviewMessage("Your review has been submitted!");
          setTimeout(() => setReviewMessage(""), 3000);
        }
      } else {
        const data = await res.json();
        setReviewMessage(("error" in data && typeof data.error === "string" ? data.error : "Failed to submit review."));
      }
    } catch {
      setReviewMessage("Error submitting review.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-2 text-xs text-gray-500">
        <Link href="/" className="hover:text-indigo-600">
          Home
        </Link>
        <span>/</span>
        <Link href="/products" className="hover:text-indigo-600">
          Catalog
        </Link>
        {product.category && (
          <>
            <span>/</span>
            <Link href={`/products?category=${product.category.slug}`} className="hover:text-indigo-600">
              {product.category.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-gray-900 font-medium truncate max-w-xs">{product.title}</span>
      </nav>

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Images */}
        <div className="space-y-4">
          <div className="aspect-square bg-gray-100 rounded-3xl overflow-hidden border border-gray-200 shadow-sm relative">
            <Image
              src={currentImg}
              alt={product.title}
              fill
              unoptimized
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="w-full h-full object-cover object-center"
            />
          </div>

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex space-x-3 overflow-x-auto pb-2">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                    selectedImage === idx
                      ? "border-indigo-600 ring-2 ring-indigo-600/20"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Image
                    src={img.url}
                    alt=""
                    width={80}
                    height={80}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details & Actions */}
        <div className="space-y-6 flex flex-col justify-between">
          <div>
            {/* Seller Pill */}
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-3">
              <Store className="w-3.5 h-3.5" />
              <span>
                Sold & shipped directly by{" "}
                <Link
                  href={`/stores/${product.seller.storeSlug}`}
                  className="underline hover:text-indigo-900"
                >
                  {product.seller.storeName}
                </Link>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
              {product.title}
            </h1>

            {/* Rating Stars */}
            <div className="flex items-center space-x-2 mt-3">
              <div className="flex items-center text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(avgRating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-300"
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-bold text-gray-800">
                {avgRating > 0 ? avgRating : "No reviews yet"}
              </span>
              <span className="text-xs text-gray-500">
                ({ratingCount} verified customer review{ratingCount === 1 ? "" : "s"})
              </span>
            </div>

            {/* Price block */}
            <div className="mt-6 flex items-baseline space-x-3">
              <span className="text-3xl font-extrabold text-gray-900">
                ₹{product.price.toFixed(2)}
              </span>
              {product.comparePrice && (
                <>
                  <span className="text-base text-gray-400 line-through">
                    ₹{product.comparePrice.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
                    Save ₹{(product.comparePrice - product.price).toFixed(2)}
                  </span>
                </>
              )}
            </div>

            {/* Inventory indicator */}
            <div className="mt-3 flex items-center space-x-2 text-xs">
              <span
                className={`w-2 h-2 rounded-full ${
                  product.inventoryCount > 5
                    ? "bg-emerald-500"
                    : product.inventoryCount > 0
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
              />
              <span className="font-semibold text-gray-700">
                {product.inventoryCount > 0
                  ? `${product.inventoryCount} units available in stock`
                  : "Currently Out of Stock"}
              </span>
            </div>

            {/* Description */}
            <div className="mt-6 prose prose-sm text-gray-600 border-t border-gray-100 pt-6">
              <p className="leading-relaxed whitespace-pre-line">{product.description}</p>
            </div>
          </div>

          {/* Action Row */}
          <div className="border-t border-gray-100 pt-6 space-y-4">
            <div className="flex items-center space-x-4">
              {/* Quantity Selector */}
              <div className="flex items-center border border-gray-300 rounded-xl bg-white px-2 py-1">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-2.5 py-1 text-gray-600 hover:text-indigo-600 font-bold"
                  disabled={product.inventoryCount <= 0}
                >
                  -
                </button>
                <span className="px-3 text-sm font-semibold text-gray-900">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.inventoryCount, quantity + 1))}
                  className="px-2.5 py-1 text-gray-600 hover:text-indigo-600 font-bold"
                  disabled={product.inventoryCount <= 0 || quantity >= product.inventoryCount}
                >
                  +
                </button>
              </div>

              {/* Add to Cart CTA */}
              <button
                onClick={handleAddToCart}
                disabled={product.inventoryCount <= 0}
                className={`flex-1 py-3.5 px-6 rounded-xl font-bold flex items-center justify-center space-x-2 shadow-lg transition-all ${
                  added
                    ? "bg-emerald-600 text-white shadow-emerald-200"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
                }`}
              >
                {added ? (
                  <>
                    <Check className="w-5 h-5" />
                    <span>Added to Multi-Vendor Bag!</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5" />
                    <span>Add to Cart - ₹{(product.price * quantity).toFixed(2)}</span>
                  </>
                )}
              </button>

              {/* Wishlist Button */}
              <button
                type="button"
                onClick={() =>
                  toggleItem({
                    id: product.id,
                    title: product.title,
                    slug: product.slug,
                    price: product.price,
                    comparePrice: product.comparePrice,
                    imageUrl: product.images[0]?.url || "",
                    sellerId: product.seller.id,
                    storeName: product.seller.storeName,
                    storeSlug: product.seller.storeSlug,
                    inStock: product.inventoryCount > 0,
                  })
                }
                title={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
                className={`p-3.5 rounded-xl border flex items-center justify-center transition-all ${
                  inWishlist
                    ? "bg-rose-50 border-rose-200 text-rose-600 shadow-sm"
                    : "bg-white border-gray-200 text-gray-600 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50"
                }`}
              >
                <Heart className={`w-5 h-5 ${inWishlist ? "fill-rose-600" : ""}`} />
              </button>
            </div>

            {/* Marketplace Guarantees */}
            <div className="grid grid-cols-2 gap-3 pt-3 text-xs text-gray-500">
              <div className="flex items-center space-x-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <Truck className="w-4 h-4 text-indigo-600" />
                <span>Direct dispatch from {product.seller.storeName}</span>
              </div>
              <div className="flex items-center space-x-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Buyer Protection Guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews & Ratings Section */}
      <section className="border-t border-gray-200 pt-12 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              <span>Customer Reviews ({reviewsList.length})</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">Real ratings submitted by verified buyers</p>
          </div>
        </div>

        {/* Submit Review Form */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm max-w-2xl">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Leave a Review</h3>
          {reviewMessage && (
            <div
              className={`mb-4 p-3 text-xs font-semibold rounded-xl border ${
                reviewMessage.includes("submitted")
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-rose-50 text-rose-700 border-rose-200"
              }`}
            >
              {reviewMessage}
            </div>
          )}

          <form onSubmit={handleReviewSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Your Rating</label>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setRating(s)}
                    className="p-1 text-amber-400 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={`w-6 h-6 ${s <= rating ? "fill-amber-400" : "text-gray-300"}`}
                    />
                  </button>
                ))}
                <span className="text-xs font-bold text-gray-700 ml-2">{rating} out of 5 stars</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Your Feedback
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your thoughts on build quality, fulfillment speed, and expectations..."
                className="w-full text-xs p-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900"
                required
              />
            </div>

            <button
              type="submit"
              disabled={reviewSubmitting || !comment.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm disabled:bg-gray-200 disabled:text-gray-400"
            >
              {reviewSubmitting ? "Submitting..." : "Submit Review"}
            </button>
          </form>
        </div>

        {/* Existing Reviews List */}
        <div className="space-y-4">
          {reviewsList.length === 0 ? (
            <p className="text-xs text-gray-500 italic">Be the first to review this product!</p>
          ) : (
            reviewsList.map((rev) => (
              <div
                key={rev.id}
                className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-gray-900">
                      {rev.buyer.name || "Verified Customer"}
                    </span>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-medium">
                      Verified Purchase
                    </span>
                  </div>
                  <div className="flex items-center text-amber-400">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3.5 h-3.5 ${
                          s <= rev.rating ? "fill-amber-400" : "text-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">{rev.comment}</p>
                <span className="text-[10px] text-gray-400 block">
                  {new Date(rev.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
