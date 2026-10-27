"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Store, ArrowRight } from "lucide-react";

import { client } from "@/lib/rpc";
import { ImageUpload } from "@/components/image-upload";

export default function SellerApplicationPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  const [form, setForm] = useState({
    storeName: "",
    description: "",
    logoUrl: "",
    bannerUrl: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await client.api.stores.apply.$post({
        json: form,
      });

      const data = await res.json();
      if (res.ok) {
        await refreshUser();
        router.push("/seller");
      } else {
        setError(("error" in data && typeof data.error === "string" ? data.error : "Failed to submit application"));
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
          <Store className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Become a Merchant on MarketHub</h1>
        <p className="text-xs text-gray-500 max-w-md mx-auto">
          Start selling to thousands of buyers. List products, manage inventory, and receive automated
          payouts with a transparent 10% platform fee.
        </p>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">Store / Brand Name</label>
            <input
              type="text"
              required
              value={form.storeName}
              onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              placeholder="e.g. Pacific Artisan Goods"
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Store Description & Bio</label>
            <textarea
              rows={3}
              required
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Tell customers and admins what your store crafts, creates, or supplies..."
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <ImageUpload
            label="Store Logo"
            value={form.logoUrl}
            onChange={(url) => setForm({ ...form, logoUrl: url })}
            folder="stores/logos"
            aspectRatio="square"
            helperText="Upload your store avatar or brand logo"
          />

          <ImageUpload
            label="Store Banner Cover"
            value={form.bannerUrl}
            onChange={(url) => setForm({ ...form, bannerUrl: url })}
            folder="stores/banners"
            aspectRatio="banner"
            helperText="Upload a wide store banner header image"
          />

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center space-x-2 transition-all disabled:bg-gray-200 disabled:text-gray-400"
            >
              <span>{submitting ? "Submitting Application..." : "Submit Seller Application"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
