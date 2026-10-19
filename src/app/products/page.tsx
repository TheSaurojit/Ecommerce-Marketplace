import Link from "next/link";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { ProductCard } from "@/components/product-card";
import { Search, Filter, RotateCcw } from "lucide-react";

export const dynamic = "force-dynamic";

interface ProductsPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    storeSlug?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const q = params.q || "";
  const categorySlug = params.category || "";
  const storeSlug = params.storeSlug || "";
  const minPrice = params.minPrice ? parseFloat(params.minPrice) : undefined;
  const maxPrice = params.maxPrice ? parseFloat(params.maxPrice) : undefined;
  const sort = params.sort || "newest";

  // Build Prisma filter
  const where: Prisma.ProductWhereInput = {
    status: "PUBLISHED",
  };

  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  if (categorySlug) {
    where.category = { slug: categorySlug };
  }

  if (storeSlug) {
    where.seller = { storeSlug };
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) where.price.gte = minPrice;
    if (maxPrice !== undefined) where.price.lte = maxPrice;
  }

  let orderBy:
    | Prisma.ProductOrderByWithRelationInput
    | Prisma.ProductOrderByWithRelationInput[] = { createdAt: "desc" };
  if (sort === "price_asc") orderBy = { price: "asc" };
  if (sort === "price_desc") orderBy = { price: "desc" };
  if (sort === "featured") orderBy = [{ featured: "desc" }, { createdAt: "desc" }];

  const [products, categories, stores] = await Promise.all([
    db.product.findMany({
      where,
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
      orderBy,
    }),
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.sellerProfile.findMany({
      where: { status: "APPROVED" },
      select: { id: true, storeName: true, storeSlug: true },
      orderBy: { storeName: "asc" },
    }),
  ]);

  const formattedProducts = products.map((p) => {
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-gray-200">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Marketplace Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">
            Showing {formattedProducts.length} product{formattedProducts.length === 1 ? "" : "s"} across all verified vendors
          </p>
        </div>

        {/* Quick Sort Links */}
        <div className="flex items-center space-x-2 text-xs font-medium">
          <span className="text-gray-500">Sort by:</span>
          <Link
            href={`/products?${new URLSearchParams({ ...params, sort: "newest" }).toString()}`}
            className={`px-3 py-1.5 rounded-lg border ${
              sort === "newest"
                ? "bg-indigo-600 text-white border-indigo-600 font-semibold"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Newest
          </Link>
          <Link
            href={`/products?${new URLSearchParams({ ...params, sort: "price_asc" }).toString()}`}
            className={`px-3 py-1.5 rounded-lg border ${
              sort === "price_asc"
                ? "bg-indigo-600 text-white border-indigo-600 font-semibold"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Price: Low &rarr; High
          </Link>
          <Link
            href={`/products?${new URLSearchParams({ ...params, sort: "price_desc" }).toString()}`}
            className={`px-3 py-1.5 rounded-lg border ${
              sort === "price_desc"
                ? "bg-indigo-600 text-white border-indigo-600 font-semibold"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            Price: High &rarr; Low
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
        {/* Filters Sidebar */}
        <aside className="lg:col-span-1 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="font-semibold text-gray-900 flex items-center space-x-1.5 text-sm">
                <Filter className="w-4 h-4 text-indigo-600" />
                <span>Filters</span>
              </span>
              <Link
                href="/products"
                className="text-xs text-indigo-600 hover:underline flex items-center space-x-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </Link>
            </div>

            {/* Keyword Search */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                Keyword
              </label>
              <form action="/products" method="GET" className="relative">
                {categorySlug && <input type="hidden" name="category" value={categorySlug} />}
                {storeSlug && <input type="hidden" name="storeSlug" value={storeSlug} />}
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="Filter by title..."
                  className="w-full text-xs pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              </form>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                Category
              </label>
              <div className="space-y-1.5">
                <Link
                  href={`/products?${new URLSearchParams({ ...params, category: "" }).toString()}`}
                  className={`block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    !categorySlug
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  All Categories
                </Link>
                {categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/products?${new URLSearchParams({ ...params, category: c.slug }).toString()}`}
                    className={`block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      categorySlug === c.slug
                        ? "bg-indigo-50 text-indigo-700 font-semibold"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Stores / Vendors Filter */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                Independent Seller
              </label>
              <div className="space-y-1.5">
                <Link
                  href={`/products?${new URLSearchParams({ ...params, storeSlug: "" }).toString()}`}
                  className={`block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    !storeSlug
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  All Stores
                </Link>
                {stores.map((s) => (
                  <Link
                    key={s.id}
                    href={`/products?${new URLSearchParams({ ...params, storeSlug: s.storeSlug }).toString()}`}
                    className={`block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      storeSlug === s.storeSlug
                        ? "bg-indigo-50 text-indigo-700 font-semibold"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {s.storeName}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <main className="lg:col-span-3">
          {formattedProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900">No products match your criteria</h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Try loosening your filters or resetting the keyword search to discover more items.
              </p>
              <Link
                href="/products"
                className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
              >
                Clear all filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {formattedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
