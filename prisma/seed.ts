import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("🌱 Starting database seed...");

  // 1. Clean existing records in reverse dependency order
  await db.payoutRecord.deleteMany();
  await db.review.deleteMany();
  await db.orderItem.deleteMany();
  await db.subOrder.deleteMany();
  await db.order.deleteMany();
  await db.productImage.deleteMany();
  await db.product.deleteMany();
  await db.category.deleteMany();
  await db.sellerProfile.deleteMany();
  await db.user.deleteMany();

  console.log("Cleared existing data.");

  // 2. Passwords
  const adminPassword = await bcrypt.hash("admin123", 10);
  const sellerPassword = await bcrypt.hash("seller123", 10);
  const buyerPassword = await bcrypt.hash("buyer123", 10);

  // 3. Create Admin
  await db.user.create({
    data: {
      name: "Platform Administrator",
      email: "admin@marketplace.com",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  // 4. Create Buyer
  const buyer = await db.user.create({
    data: {
      name: "Alex Johnson",
      email: "buyer@marketplace.com",
      passwordHash: buyerPassword,
      role: "BUYER",
    },
  });

  // 5. Create Approved Seller 1 - Apex Electronics
  const sellerUser1 = await db.user.create({
    data: {
      name: "David Chen",
      email: "apex@marketplace.com",
      passwordHash: sellerPassword,
      role: "SELLER",
      sellerProfile: {
        create: {
          storeName: "Apex Electronics",
          storeSlug: "apex-electronics",
          description: "Premium consumer audio, smart home devices, and developer peripherals.",
          logoUrl: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=200&q=80",
          bannerUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
          status: "APPROVED",
          commissionRate: 0.1, // 10%
          payoutsEnabled: true,
        },
      },
    },
    include: { sellerProfile: true },
  });

  // 6. Create Approved Seller 2 - Nordic Living Studio
  const sellerUser2 = await db.user.create({
    data: {
      name: "Astrid Lindgren",
      email: "nordic@marketplace.com",
      passwordHash: sellerPassword,
      role: "SELLER",
      sellerProfile: {
        create: {
          storeName: "Nordic Living Studio",
          storeSlug: "nordic-living",
          description: "Minimalist Scandinavian home decor, ergonomic work essentials, and ceramics.",
          logoUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=200&q=80",
          bannerUrl: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80",
          status: "APPROVED",
          commissionRate: 0.12, // 12%
          payoutsEnabled: true,
        },
      },
    },
    include: { sellerProfile: true },
  });

  // 7. Create Pending Seller 3 - Artisan Leathercraft (for Admin approval testing)
  await db.user.create({
    data: {
      name: "Marcus Vance",
      email: "artisan@marketplace.com",
      passwordHash: sellerPassword,
      role: "BUYER",
      sellerProfile: {
        create: {
          storeName: "Artisan Leathercraft",
          storeSlug: "artisan-leather",
          description: "Handcrafted full-grain leather bags, wallets, and desk mats made to order.",
          logoUrl: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=200&q=80",
          bannerUrl: "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=1200&q=80",
          status: "PENDING_APPROVAL",
          commissionRate: 0.1,
          payoutsEnabled: false,
        },
      },
    },
    include: { sellerProfile: true },
  });

  // 8. Create Categories
  const catTech = await db.category.create({
    data: {
      name: "Electronics & Tech",
      slug: "electronics-tech",
      description: "Smart hardware, high-fidelity audio, and computing gear.",
      imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80",
    },
  });

  const catHome = await db.category.create({
    data: {
      name: "Home & Interior",
      slug: "home-interior",
      description: "Ergonomic furniture, ambient lighting, and artisan stoneware.",
      imageUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80",
    },
  });

  await db.category.create({
    data: {
      name: "Lifestyle & Apparel",
      slug: "lifestyle-apparel",
      description: "Timeless handcrafted accessories, durable travel kits, and footwear.",
      imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",
    },
  });

  // 9. Products for Apex Electronics
  const prodHeadphones = await db.product.create({
    data: {
      sellerId: sellerUser1.sellerProfile!.id,
      categoryId: catTech.id,
      title: "Apex Horizon Pro Wireless Noise-Cancelling Headphones",
      slug: "apex-horizon-pro-headphones",
      description:
        "Flagship wireless over-ear headphones featuring bespoke 45mm neodymium drivers, 40-hour battery life, hybrid active noise cancellation, and ultra-plush memory foam earpads.",
      price: 249.99,
      comparePrice: 299.99,
      inventoryCount: 45,
      status: "PUBLISHED",
      featured: true,
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
            altText: "Apex Horizon Headphones Front",
            sortOrder: 0,
          },
          {
            url: "https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=800&q=80",
            altText: "Apex Horizon Angle",
            sortOrder: 1,
          },
        ],
      },
    },
  });

  await db.product.create({
    data: {
      sellerId: sellerUser1.sellerProfile!.id,
      categoryId: catTech.id,
      title: "Vanguard 75 Mechanical Keyboard (Gateron Oil Kings)",
      slug: "vanguard-75-mechanical-keyboard",
      description:
        "Gasket-mounted CNC anodized aluminum 75% layout keyboard with south-facing RGB, hot-swappable sockets, and lubed stabilizer tuning for supreme acoustic satisfaction.",
      price: 189.0,
      comparePrice: 219.0,
      inventoryCount: 22,
      status: "PUBLISHED",
      featured: true,
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=80",
            altText: "Mechanical Keyboard top view",
            sortOrder: 0,
          },
        ],
      },
    },
  });

  // 10. Products for Nordic Living Studio
  const prodDeskLamp = await db.product.create({
    data: {
      sellerId: sellerUser2.sellerProfile!.id,
      categoryId: catHome.id,
      title: "Koben Minimalist Warm LED Task Lamp",
      slug: "koben-minimalist-led-task-lamp",
      description:
        "Brushed matte brass articulating arm with touch-dimmable CRI 95 warm ambient LED bar. Ideal for focus desks and reading corners.",
      price: 119.5,
      comparePrice: 145.0,
      inventoryCount: 30,
      status: "PUBLISHED",
      featured: true,
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=800&q=80",
            altText: "Minimalist Brass Desk Lamp",
            sortOrder: 0,
          },
        ],
      },
    },
  });

  await db.product.create({
    data: {
      sellerId: sellerUser2.sellerProfile!.id,
      categoryId: catHome.id,
      title: "Nordic Speckled Stoneware Ceramic Set (Set of 2)",
      slug: "nordic-speckled-stoneware-set",
      description:
        "Hand-thrown matte speckled ceramic mugs finished in earth glaze. Microwave and dishwasher safe, 350ml capacity.",
      price: 42.0,
      comparePrice: 50.0,
      inventoryCount: 50,
      status: "PUBLISHED",
      featured: false,
      images: {
        create: [
          {
            url: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
            altText: "Handmade ceramic cups",
            sortOrder: 0,
          },
        ],
      },
    },
  });

  // 11. Initial Reviews
  await db.review.create({
    data: {
      productId: prodHeadphones.id,
      buyerId: buyer.id,
      rating: 5,
      comment: "Incredible sound clarity and the noise cancellation blocks out all office chatter!",
    },
  });

  await db.review.create({
    data: {
      productId: prodDeskLamp.id,
      buyerId: buyer.id,
      rating: 5,
      comment: "Aesthetically gorgeous on my walnut desk, the dimmer setting is silky smooth.",
    },
  });

  console.log("✅ Seed completed successfully!");
  console.log("Credentials created:");
  console.log("  Admin: admin@marketplace.com / admin123");
  console.log("  Seller 1: apex@marketplace.com / seller123");
  console.log("  Seller 2: nordic@marketplace.com / seller123");
  console.log("  Pending Seller: artisan@marketplace.com / seller123");
  console.log("  Buyer: buyer@marketplace.com / buyer123");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    // cleanup
  });
