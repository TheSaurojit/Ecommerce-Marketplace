import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ProductDetailView } from "@/components/product-detail-view";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  const product = await db.product.findUnique({
    where: { slug },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      category: true,
      seller: {
        select: {
          id: true,
          storeName: true,
          storeSlug: true,
          description: true,
          logoUrl: true,
          bannerUrl: true,
        },
      },
      reviews: {
        include: {
          buyer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!product || (product.status !== "PUBLISHED" && product.status !== "OUT_OF_STOCK")) {
    notFound();
  }

  const formattedProduct = {
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description,
    price: Number(product.price),
    comparePrice: product.comparePrice ? Number(product.comparePrice) : null,
    inventoryCount: product.inventoryCount,
    images: product.images,
    category: product.category,
    seller: product.seller,
    reviews: product.reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      buyer: { name: r.buyer.name },
    })),
  };

  return <ProductDetailView product={formattedProduct} />;
}
