import Link from "next/link";
import Image from "next/image";
import { db } from "@/lib/db";
import { ProductCard } from "@/components/product-card";
import {
  ArrowRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  Tag,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, featuredProducts, sellers] = await Promise.all([
    db.category.findMany({
      include: {
        _count: { select: { products: { where: { status: "PUBLISHED" } } } },
      },
      take: 6,
    }),
    db.product.findMany({
      where: { status: "PUBLISHED" },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        category: true,
        seller: {
          select: { id: true, storeName: true, storeSlug: true, logoUrl: true },
        },
        reviews: { select: { rating: true } },
      },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    db.sellerProfile.findMany({
      where: { status: "APPROVED" },
      include: {
        _count: { select: { products: { where: { status: "PUBLISHED" } } } },
      },
      take: 4,
    }),
  ]);

  const formattedProducts = featuredProducts.map((p) => {
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

  const categoryImages: Record<string, string> = {
    electronics:
      "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=800&q=80",
    "home-living":
      "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80",
    fashion:
      "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=800&q=80",
    "sports-outdoors":
      "https://images.unsplash.com/photo-1526401485004-46910ecc8e51?auto=format&fit=crop&w=800&q=80",
    "books-media":
      "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=800&q=80",
    default:
      "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80",
  };

  return (
    <div className="bg-[#fafaf9]">

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0d0b1e]">
        {/* Background blobs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 -left-40 w-[700px] h-[700px] rounded-full bg-violet-700/25 blur-[140px]" />
          <div className="absolute top-1/3 right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/15 blur-[100px]" />
          <div className="absolute bottom-0 left-1/2 w-[600px] h-[300px] -translate-x-1/2 rounded-full bg-fuchsia-800/10 blur-[80px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center py-20 lg:py-28">
            {/* Left copy */}
            <div>
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/15 border border-amber-400/25 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-7">
                <Tag className="w-3.5 h-3.5" />
                New arrivals every week
              </span>

              <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-white leading-[1.05]">
                Shop from the<br />
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-pink-400 bg-clip-text text-transparent">
                  world&apos;s best
                </span>{" "}
                independent brands.
              </h1>

              <p className="mt-6 text-slate-400 text-base leading-relaxed max-w-lg">
                Discover unique products from verified sellers — electronics, home goods, fashion
                and more. Free delivery on all orders.
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/products"
                  className="group inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm shadow-[0_0_36px_rgba(124,58,237,0.45)] hover:shadow-[0_0_48px_rgba(124,58,237,0.55)] transition-all duration-200"
                >
                  Shop Now
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
                <Link
                  href="/stores"
                  className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl bg-white/8 hover:bg-white/14 text-white border border-white/15 hover:border-white/30 font-semibold text-sm transition-all backdrop-blur-sm"
                >
                  Browse Stores
                </Link>
              </div>

              {/* Trust micro-stats */}
              <div className="mt-10 flex flex-wrap gap-6">
                {[
                  { num: `${sellers.length}+`, label: "Verified Stores" },
                  { num: `${formattedProducts.length}+`, label: "Products" },
                  { num: "100%", label: "Secure Checkout" },
                ].map(({ num, label }) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-2xl font-black text-white">{num}</span>
                    <span className="text-xs text-slate-400 mt-0.5">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — featured product mosaic */}
            {formattedProducts.length > 0 && (
              <div className="hidden lg:grid grid-cols-2 gap-3 h-[440px]">
                {/* Tall left image */}
                <Link
                  href={`/products/${formattedProducts[0].slug}`}
                  className="row-span-2 relative rounded-2xl overflow-hidden group"
                >
                  <Image
                    src={formattedProducts[0].images[0]?.url ||
                      "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80"}
                    alt={formattedProducts[0].title}
                    fill
                    unoptimized
                    sizes="(max-width: 1280px) 50vw, 33vw"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-[10px] text-violet-300 font-bold uppercase tracking-wider">Featured</p>
                    <p className="text-sm font-bold text-white line-clamp-1 mt-0.5">{formattedProducts[0].title}</p>
                    <p className="text-sm font-black text-amber-400 mt-1">₹{formattedProducts[0].price.toFixed(2)}</p>
                  </div>
                </Link>

                {/* Two smaller right images */}
                {formattedProducts.slice(1, 3).map((p) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.slug}`}
                    className="relative rounded-2xl overflow-hidden group"
                  >
                    <Image
                      src={p.images[0]?.url ||
                        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80"}
                      alt={p.title}
                      fill
                      unoptimized
                      sizes="(max-width: 1280px) 25vw, 20vw"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <p className="text-xs font-semibold text-white line-clamp-1">{p.title}</p>
                      <p className="text-sm font-black text-amber-400 mt-0.5">₹{p.price.toFixed(2)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-[#fafaf9] to-transparent" />
      </section>

      {/* ── SERVICE PROMISE STRIP ─────────────────────────────────────── */}
      <div className="border-b border-slate-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
            {[
              { icon: Truck, title: "Free Delivery", desc: "On every order, always" },
              { icon: RotateCcw, title: "Easy Returns", desc: "30-day hassle-free returns" },
              { icon: ShieldCheck, title: "Buyer Protection", desc: "100% secure payments" },
              { icon: TrendingUp, title: "Best Prices", desc: "Competitive across all stores" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-center gap-3 py-5 px-4 sm:px-6">
                <div className="p-2.5 rounded-xl bg-violet-50 flex-shrink-0">
                  <Icon className="w-4 h-4 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{title}</p>
                  <p className="text-[11px] text-slate-500 truncate">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CATEGORIES ───────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-4">
        <div className="flex items-end justify-between mb-7">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Shop by Category</h2>
            <p className="text-sm text-slate-500 mt-1">Find what you&apos;re looking for</p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-600 hover:text-violet-800 transition-colors"
          >
            All Products <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => {
            const img = cat.imageUrl || categoryImages[cat.slug] || categoryImages.default;
            return (
              <Link
                key={cat.id}
                href={`/products?category=${cat.slug}`}
                className="group relative rounded-2xl overflow-hidden aspect-square bg-slate-100"
              >
                <Image
                  src={img}
                  alt={cat.name}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 50vw, 16vw"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 px-2 text-center">
                  <h3 className="text-sm font-black text-white leading-tight">{cat.name}</h3>
                  <span className="text-[10px] text-slate-300 mt-0.5">{cat._count.products} items</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── PROMO BANNER ─────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-700 via-violet-600 to-fuchsia-600 p-8 md:p-12">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute right-0 top-0 w-96 h-96 rounded-full bg-white/5 blur-[60px]" />
            <div className="absolute -bottom-20 left-1/4 w-80 h-80 rounded-full bg-fuchsia-400/10 blur-[50px]" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <span className="inline-block text-[10px] font-black uppercase tracking-widest text-violet-200 bg-white/10 px-3 py-1 rounded-full mb-3">
                Limited Time
              </span>
              <h2 className="text-2xl md:text-3xl font-black text-white leading-tight">
                New stores join every week.<br />
                <span className="text-violet-200">Discover them first.</span>
              </h2>
              <p className="mt-2 text-sm text-violet-200/80">
                Browse the latest verified stores and find unique products you won&apos;t see anywhere else.
              </p>
            </div>
            <Link
              href="/stores"
              className="flex-shrink-0 inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-white text-violet-700 font-black text-sm hover:bg-violet-50 transition-colors shadow-lg shadow-violet-900/20"
            >
              Explore All Stores
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── TRENDING PRODUCTS ────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="flex items-end justify-between mb-7">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Trending Now</h2>
            <p className="text-sm text-slate-500 mt-1">Bestsellers picked across all stores</p>
          </div>
          <Link
            href="/products"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-600 hover:text-violet-800 transition-colors"
          >
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {formattedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ── FEATURED STORES ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-20">
        <div className="flex items-end justify-between mb-7">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Top Stores</h2>
            <p className="text-sm text-slate-500 mt-1">Verified independent sellers</p>
          </div>
          <Link
            href="/stores"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-violet-600 hover:text-violet-800 transition-colors"
          >
            All Stores <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {sellers.map((store) => (
            <Link
              key={store.id}
              href={`/stores/${store.storeSlug}`}
              className="group bg-white border border-slate-100 rounded-2xl p-5 hover:shadow-[0_8px_30px_rgba(109,71,200,0.12)] hover:border-violet-100 hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-3">
                <Image
                  src={
                    store.logoUrl ||
                    "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=200&q=80"
                  }
                  alt={store.storeName}
                  width={48}
                  height={48}
                  unoptimized
                  className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                />
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 group-hover:text-violet-700 transition-colors truncate text-sm">
                    {store.storeName}
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold mt-0.5">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Seller
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                {store.description || "Independent store with curated products."}
              </p>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100 text-xs">
                <span className="text-slate-400 font-medium">{store._count.products} products</span>
                <span className="text-violet-600 font-bold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                  Shop now <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
