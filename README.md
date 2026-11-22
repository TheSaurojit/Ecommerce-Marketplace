# Demo URL
https://ecommerce-marketplace-flax.vercel.app/

# 🛒 Multi-Vendor E-Commerce Marketplace

A full-stack, multi-vendor marketplace platform built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS v4**, **Prisma ORM 7**, **PostgreSQL**, **Hono**, and **Stripe**.

---

## 🌟 Features

- **Multi-Vendor Architecture**:
  - **Buyer**: Browse catalog, filter by category/price, manage cart & wishlist, secure checkout with Stripe, order history, and product reviews.
  - **Seller**: Storefront customization (banner, logo, bio), product & inventory management, order fulfillment, and revenue analytics.
  - **Admin**: Review & approve/reject seller store applications, platform-wide commission management, store suspension, and analytics.
- **Modern API Layer**: [Hono](https://hono.dev/) mounted seamlessly within Next.js App Router (`/api/[[...route]]`) with strict Zod schema validation.
- **Real-Time Live Updates**: Universal in-process Server-Sent Events (SSE) bus (`/api/realtime/events`) with optional Supabase Realtime broadcast bridge:
  - **Buyer**: Live order and shipment tracking on `/orders` (instant transitions to `SHIPPED` with carrier and tracking info without page reloads).
  - **Seller**: Instant order dispatch feed on `/seller` (real-time alerts when payments are confirmed or orders cancelled, with live metric refreshes).
  - **Public**: Real-time stock sync & flash purchase alerts on Product Details (`/products/[slug]`).
- **Robust Database**: PostgreSQL orchestrated via Docker Compose, modeled with Prisma ORM 7 using the PostgreSQL driver adapter (`@prisma/adapter-pg`).
- **Authentication**: Stateless JWT token authentication with role-based route protection (`ADMIN`, `SELLER`, `BUYER`).
- **Payment Processing**: Stripe Checkout integration supporting split orders across multiple vendors, with webhook handling.
- **Media Storage & Realtime**: Supabase Storage for product images and store banners, with optional Supabase Realtime Channels for distributed WebSocket broadcasts.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router & Turbopack)
- **UI / Library**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [Recharts](https://recharts.org/)
- **API Framework**: [Hono](https://hono.dev/) + `@hono/zod-validator` + [Zod](https://zod.dev/)
- **Real-Time Engine**: Server-Sent Events (SSE via Hono `streamSSE`) + in-process event bus + optional Supabase Realtime Channels
- **ORM & Database**: [Prisma ORM 7](https://www.prisma.io/) + [PostgreSQL 16](https://www.postgresql.org/)
- **Containerization**: [Docker](https://www.docker.com/) & Docker Compose
- **Authentication**: [Jose](https://github.com/panva/jose) (JWT) + [Bcrypt.js](https://github.com/dcodeIO/bcrypt.js)
- **Payments**: [Stripe](https://stripe.com/)
- **File Storage**: [Supabase Storage](https://supabase.com/storage)

---

## 📋 Prerequisites

Before starting, make sure you have the following installed on your machine:

- **Node.js**: `v20.x` or `v24.x` (recommended)
- **Package Manager**: `npm` (v10+), `pnpm`, `yarn`, or `bun`
- **Docker & Docker Compose**: Installed and running (for local PostgreSQL database)
- **Git**

---

## 🚀 Quick Start Guide (Local Setup)

Follow these step-by-step instructions to get the application running locally:

### 1. Clone the Repository

```bash
git clone <repository-url>
cd "Ecommerce Marketplace"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a local `.env` file from the example:

```powershell
Copy-Item .env.example .env
```

The example is configured to connect to the local PostgreSQL container on port `5434`. Replace the placeholder Stripe and Supabase values with your own test credentials to use checkout and image uploads. Keep `.env` local and do not commit it.

### 4. Start the Database (Docker Compose)

Start the PostgreSQL container in detached mode:

```bash
docker compose up -d
```

Verify that the container is healthy and running on port `5434`:

```bash
docker compose ps
```

### 5. Run Database Migrations & Generate Prisma Client

Apply database migrations to the PostgreSQL database:

```bash
npm run db:deploy # or 'npm run db:migrate' to create new migrations in development
```

Generate the Prisma Client types:

```bash
npm run db:generate
```

### 6. Seed the Database

Populate the database with sample categories, stores, products, reviews, and test user accounts:

```bash
npm run db:seed
```

### 7. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ✅ GitHub CI

GitHub Actions runs the CI workflow on every push and pull request. It uses `npm ci` to install the exact versions recorded in `package-lock.json`, then generates the Prisma Client and runs lint and TypeScript checks. No Stripe or Supabase secrets are needed for these checks.

---

## 🔑 Demo & Test Accounts

The seed script creates ready-to-use accounts for each user role:

| Role | Email | Password | Access / Purpose |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@marketplace.com` | `admin123` | Access `/admin` dashboard to approve sellers and view platform metrics |
| **Seller (Approved)** | `apex@marketplace.com` | `seller123` | Manage "Apex Electronics" store, inventory, and orders at `/seller` |
| **Seller (Approved)** | `nordic@marketplace.com` | `seller123` | Manage "Nordic Living Studio" store at `/seller` |
| **Seller (Pending)** | `artisan@marketplace.com` | `seller123` | Store under review ("Artisan Leathercraft") - test admin approval flow |
| **Buyer** | `buyer@marketplace.com` | `buyer123` | Standard shopper account with orders, reviews, and wishlist |

---

## ⚙️ Environment Variables Reference

| Variable | Description | Default / Example (Local) |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgrespassword@localhost:5434/marketplace?schema=public` |
| `JWT_SECRET` | Secret key used to sign & verify JWT sessions | Minimum 32 characters string |
| `NEXTAUTH_SECRET` | Alternative secret key for auth middleware | Minimum 32 characters string |
| `NEXT_PUBLIC_APP_URL` | Base URL of the client application | `http://localhost:3000` |
| `NEXT_PUBLIC_DEFAULT_COMMISSION_RATE` | Default marketplace platform fee | `0.10` (10%) |
| `STRIPE_SECRET_KEY` | Stripe secret API key (Test mode) | `sk_test_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable API key (Test mode) | `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook secret for Stripe event validation | `whsec_...` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (Cloud storage & realtime) | `https://<project-id>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`| Supabase public anon key (Storage & private realtime channels) | `sb_publishable_...` |
| `SUPABASE_SECRET_KEY` | Supabase service role secret key (Server-side storage & broadcast) | `sb_secret_...` |
| `SUPABASE_JWT_SECRET` | Supabase project JWT secret (API > JWT Settings) for Realtime Auth | `your-supabase-jwt-secret` |
| `SUPABASE_STORAGE_BUCKET` | Supabase storage bucket name | `marketplace-images` |

> [!NOTE]
> **Real-Time Transport Architecture**: When deployed in serverless environments (e.g. Vercel), the application uses **Supabase Realtime Private Channels** as the primary transport to eliminate in-process event loss. In offline/local environments without Supabase credentials, it automatically falls back to the built-in Server-Sent Events (SSE) bus (`/api/realtime/events`). See below for Supabase Realtime Authorization setup.

---

### ⚡ Supabase Realtime Authorization Setup

To enable secure private realtime channels on Supabase:

1. **Configure JWT Secret**:
   - In Supabase Dashboard, go to **Project Settings > API > JWT Settings**.
   - Copy your **JWT Secret** and set `SUPABASE_JWT_SECRET="<secret>"` in your `.env` and Vercel project environment variables.

2. **Execute RLS Policies in Supabase SQL Editor**:
   Run the following SQL snippet in your Supabase SQL Editor to authorize private channels on `realtime.messages`:

   ```sql
   -- 1. Public stock updates: anyone (authenticated or anonymous) can receive live stock updates
   CREATE POLICY "Public stock topic is readable by all"
   ON realtime.messages
   FOR SELECT
   TO authenticated, anon
   USING (
     realtime.topic() LIKE 'product:stock:%'
   );

   -- 2. Buyer orders: authenticated buyers can only read their own order topics
   CREATE POLICY "Buyers can read their own order topics"
   ON realtime.messages
   FOR SELECT
   TO authenticated
   USING (
     realtime.topic() = ('buyer:orders:' || (auth.jwt()->>'userId'))
     OR (auth.jwt()->>'userRole') = 'ADMIN'
   );

   -- 3. Seller orders: authenticated sellers can only read their own store topics
   CREATE POLICY "Sellers can read their own store order topics"
   ON realtime.messages
   FOR SELECT
   TO authenticated
   USING (
     realtime.topic() = ('seller:orders:' || (auth.jwt()->>'sellerProfileId'))
     OR (auth.jwt()->>'userRole') = 'ADMIN'
   );

   -- 4. Admin alerts: platform admins can read admin alerts
   CREATE POLICY "Admins can read admin alerts"
   ON realtime.messages
   FOR SELECT
   TO authenticated
   USING (
     realtime.topic() = 'admin:alerts'
     AND (auth.jwt()->>'userRole') = 'ADMIN'
   );

   -- Note: No INSERT policy is created for authenticated or anon roles.
   -- Only the backend server (using SUPABASE_SECRET_KEY / service_role) can broadcast events.
   ```

---

## 📜 Available NPM Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts Next.js development server with Turbopack at `http://localhost:3000` |
| `npm run build` | Compiles the production build |
| `npm run start` | Starts the production server |
| `npm run lint` | Runs ESLint check across all files |
| `npm test` | Runs the Vitest integration test suite (order lifecycle, payments, refunds, and real-time SSE streams) |
| `npm run db:migrate` | Creates and applies new migrations during development (`prisma migrate dev`) |
| `npm run db:deploy` | Applies all pending migrations in production / CI (`prisma migrate deploy`) |
| `npm run db:reset` | Drops, recreates, runs migrations, and seeds the dev database (`prisma migrate reset`) |
| `npm run db:generate` | Re-generates the Prisma Client TypeScript definitions |
| `npm run db:seed` | Runs `prisma/seed.ts` to reset and seed mock marketplace data |
| `npm run db:studio` | Opens Prisma Studio (interactive visual database GUI) |

---

## 📁 Project Structure

```text
├── docker-compose.yml          # PostgreSQL 16 container definition (Port 5434)
├── prisma/
│   ├── schema.prisma           # Prisma data models (User, SellerProfile, Product, Order, etc.)
│   └── seed.ts                 # Database seed script with sample data & test accounts
├── prisma.config.ts            # Prisma 7 configuration file
├── src/
│   ├── app/                    # Next.js 16 App Router
│   │   ├── (auth)/             # Login and Registration routes
│   │   ├── admin/              # Admin dashboard & seller approval management
│   │   ├── checkout/           # Checkout flow & Stripe redirect handlers
│   │   ├── orders/             # Customer order history (with real-time shipment updates)
│   │   ├── products/           # Product listings, filters, and dynamic [slug] details
│   │   ├── seller/             # Seller dashboard & live order dispatch notifications
│   │   ├── stores/             # Public vendor storefronts ([slug])
│   │   ├── wishlist/           # Customer saved products
│   │   └── api/                # Next.js API route handlers
│   │       ├── [[...route]]/   # Hono API router mount point (/api/realtime/events, etc.)
│   │       └── webhooks/stripe # Stripe webhook listener
│   ├── components/             # Reusable UI components (Navbar, Footer, Modals, Cards, PDP)
│   ├── context/                # React Context providers (Auth, Cart, Wishlist)
│   ├── hooks/                  # Custom hooks (useRealtimeSubscription)
│   ├── lib/                    # Database client, auth utils, realtime event bus, Supabase client
│   └── server/                 # Hono API backend logic
│       ├── middleware/         # Auth and role-checking middlewares
│       └── routes/             # Endpoints (auth, products, orders, stores, admin, upload, realtime)
└── public/                     # Static assets & icons
```

---

## 💳 Stripe Webhook Testing (Optional)

To test Stripe Checkout events and automatic order status updates locally:

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. Login to your Stripe account:
   ```bash
   stripe login
   ```
3. Forward webhook events to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```
4. Copy the webhook signing secret output (`whsec_...`) and update `STRIPE_WEBHOOK_SECRET` in `.env`.

---

## ❓ Troubleshooting

<details>
<summary><strong>1. Database connection fails (P1001 / ECONNREFUSED)</strong></summary>

- Verify Docker is running: `docker info`.
- Make sure the container is up: `docker compose ps`.
- Check if port `5434` is already in use by another service on your system:
  ```powershell
  Get-NetTCPConnection -LocalPort 5434
  ```
- If needed, restart the container:
  ```bash
  docker compose down
  docker compose up -d
  ```
</details>

<details>
<summary><strong>2. Prisma Client is out of date or missing types</strong></summary>

If you update `prisma/schema.prisma` or see type errors related to `@/generated/prisma`:
```bash
npm run db:migrate
npm run db:generate
```
Restart your development server or TypeScript language server.
</details>

<details>
<summary><strong>3. Resetting the database completely</strong></summary>

To wipe and re-seed the database:
```bash
docker compose down -v
docker compose up -d
npm run db:deploy
npm run db:seed
```
</details>

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
