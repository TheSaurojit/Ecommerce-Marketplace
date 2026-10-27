import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { ProductCard } from "@/components/product-card";
import { ShieldCheck, ArrowLeft, Package } from "lucide-react";

export const dynamic = "force-dynamic";

interface StorePageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function StoreProfilePage({ params }: StorePageProps) {
  const { slug } = await params;

  const store = await db.sellerProfile.findUnique({
    where: { storeSlug: slug },
    include: {
      products: {
        where: { status: "PUBLISHED" },
        include: {
          images: { orderBy: { sortOrder: "asc" } },
          category: true,
          seller: {
            select: {
              id: true,
              storeName: true,
              storeSlug: true,
              logoUrl: true,
            },
          },
          reviews: { select: { rating: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!store || store.status !== "APPROVED") {
    notFound();
  }

  const formattedProducts = store.products.map((p) => {
    const ratingCount = p.reviews.length;
    const avgRating =
      ratingCount > 0
        ? Number((p.reviews.reduce((acc, r) => acc + r.rating, 0) / ratingCount).toFixed(1))
        : 0;

    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      description: p.description,
      price: Number(p.price),
      comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
      inventoryCount: p.inventoryCount,
      featured: p.featured,
      category: p.category,
      seller: p.seller,
      images: p.images,
      ratingCount,
      avgRating,
    };
  });

  return (
    <div className="space-y-10 pb-16">
      {/* Banner & Profile Info */}
      <div className="relative">
        <div className="h-56 sm:h-72 w-full bg-slate-900 overflow-hidden relative">
          <Image
            src={
              store.bannerUrl ||
              "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80"
            }
            alt={store.storeName}
            fill
            unoptimized
            sizes="100vw"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-16 sm:-mt-20 flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-gray-200">
            <div className="flex items-end space-x-4">
              <Image
                src={
                  store.logoUrl ||
                  "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=200&q=80"
                }
                alt=""
                width={112}
                height={112}
                unoptimized
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-4 border-white shadow-xl bg-white flex-shrink-0"
              />
              <div className="mb-2">
                <div className="flex items-center space-x-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                    {store.storeName}
                  </h1>
                  <span className="text-emerald-600" title="Verified Independent Brand">
                    <ShieldCheck className="w-5 h-5 fill-emerald-100" />
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Member since {new Date(store.createdAt).getFullYear()} • Ships nationwide
                </p>
              </div>
            </div>

            <Link
              href="/stores"
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-gray-600 hover:text-indigo-600 bg-white border border-gray-200 px-3.5 py-2 rounded-xl shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>All Stores</span>
            </Link>
          </div>

          {/* Description */}
          {store.description && (
            <p className="text-xs text-gray-600 mt-4 max-w-3xl leading-relaxed">
              {store.description}
            </p>
          )}
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
            <Package className="w-5 h-5 text-indigo-600" />
            <span>Storefront Products ({formattedProducts.length})</span>
          </h2>
        </div>

        {formattedProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-xs text-gray-500">
            This merchant has not published any products yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {formattedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
