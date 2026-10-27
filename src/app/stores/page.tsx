import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { ShieldCheck, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StoresDirectoryPage() {
  const stores = await db.sellerProfile.findMany({
    where: { status: "APPROVED" },
    include: {
      _count: {
        select: { products: { where: { status: "PUBLISHED" } } },
      },
    },
    orderBy: { storeName: "asc" },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Independent Stores Directory</h1>
        <p className="text-sm text-gray-500 mt-1">
          Explore independent brands, artisan makers, and verified electronics manufacturers
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {stores.map((store) => (
          <div
            key={store.id}
            className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group"
          >
            <div>
              {/* Banner */}
              <div className="h-32 bg-gray-100 relative overflow-hidden">
                <Image
                  src={
                    store.bannerUrl ||
                    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80"
                  }
                  alt={store.storeName}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* Profile Card Info */}
              <div className="p-6 relative -mt-10">
                <Image
                  src={
                    store.logoUrl ||
                    "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=200&q=80"
                  }
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="w-16 h-16 rounded-2xl object-cover border-4 border-white shadow-md bg-white mb-3"
                />

                <div className="flex items-center space-x-2">
                  <h2 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {store.storeName}
                  </h2>
                  <span className="text-emerald-600 flex items-center" title="Verified Merchant">
                    <ShieldCheck className="w-4 h-4 fill-emerald-100" />
                  </span>
                </div>

                <p className="text-xs text-gray-600 mt-2 line-clamp-3 leading-relaxed">
                  {store.description || "Curated independent seller on MarketHub."}
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600">
                {store._count.products} Products Available
              </span>
              <Link
                href={`/stores/${store.storeSlug}`}
                className="font-bold text-indigo-600 hover:text-indigo-700 flex items-center space-x-1"
              >
                <span>Visit Storefront</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
