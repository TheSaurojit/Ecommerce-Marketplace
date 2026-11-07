/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { app } from "@/server";
import { db } from "@/lib/db";
import { signSession } from "@/server/auth";
import { markOrderPaid } from "@/server/order-lifecycle";

// Mock Stripe so integration tests do not invoke external Stripe HTTP endpoints
const mockRefundCreate = vi.fn().mockResolvedValue({ id: "re_mock_123", status: "succeeded" });
const mockTransferCreate = vi.fn().mockResolvedValue({ id: "tr_mock_123" });

vi.mock("@/lib/stripe", () => ({
  createStripeCheckoutSession: vi.fn().mockImplementation(async ({ orderId }) => ({
    sessionId: `cs_test_${orderId}`,
    url: `https://checkout.stripe.com/pay/cs_test_${orderId}`,
  })),
  isStripeConfigured: vi.fn().mockReturnValue(true),
  stripe: {
    refunds: {
      create: (...args: any[]) => mockRefundCreate(...args),
    },
    transfers: {
      create: (...args: any[]) => mockTransferCreate(...args),
    },
  },
  stripePublishableKey: "pk_test_mock",
  stripeWebhookSecret: "whsec_mock",
}));

describe("Order Lifecycle Integration Test (Checkout, Payment, Cancellation, Payouts)", () => {
  let buyerToken: string;
  let sellerToken: string;
  let adminToken: string;

  let buyerUser: any;
  let sellerUser: any;
  let sellerProfile: any;
  let adminUser: any;
  let category: any;
  let product: any;

  let baselineSellerGross = 0;
  let baselineSellerNet = 0;
  let baselineSellerOrders = 0;
  let baselineAdminGmv = 0;
  let baselineAdminPlatformRevenue = 0;

  beforeAll(async () => {
    // 1. Create Buyer
    buyerUser = await db.user.create({
      data: {
        name: "Lifecycle Test Buyer",
        email: `buyer_${Date.now()}@test.com`,
        role: "BUYER",
      },
    });
    buyerToken = await signSession({
      userId: buyerUser.id,
      email: buyerUser.email,
      role: "BUYER",
    });

    // 2. Create Seller
    sellerUser = await db.user.create({
      data: {
        name: "Lifecycle Test Seller",
        email: `seller_${Date.now()}@test.com`,
        role: "SELLER",
      },
    });
    sellerProfile = await db.sellerProfile.create({
      data: {
        userId: sellerUser.id,
        storeName: `Test Store ${Date.now()}`,
        storeSlug: `test-store-${Date.now()}`,
        status: "APPROVED",
        commissionRate: 0.1, // 10% commission
      },
    });
    sellerToken = await signSession({
      userId: sellerUser.id,
      email: sellerUser.email,
      role: "SELLER",
      sellerProfileId: sellerProfile.id,
    });

    // 3. Create Admin
    adminUser = await db.user.create({
      data: {
        name: "Lifecycle Test Admin",
        email: `admin_${Date.now()}@test.com`,
        role: "ADMIN",
      },
    });
    adminToken = await signSession({
      userId: adminUser.id,
      email: adminUser.email,
      role: "ADMIN",
    });

    // 4. Create Category
    category = await db.category.create({
      data: {
        name: `Test Cat ${Date.now()}`,
        slug: `test-cat-${Date.now()}`,
      },
    });

    // 5. Create Product
    product = await db.product.create({
      data: {
        sellerId: sellerProfile.id,
        categoryId: category.id,
        title: "Lifecycle Test Widget",
        slug: `lifecycle-widget-${Date.now()}`,
        description: "Widget for testing full checkout and order lifecycle",
        price: 100.0,
        inventoryCount: 10,
        status: "PUBLISHED",
      },
    });

    // Record baseline metrics
    const sellerAnalyticsRes = await app.request("/api/analytics/seller", {
      method: "GET",
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    const sellerAnalytics = await sellerAnalyticsRes.json();
    baselineSellerGross = sellerAnalytics.summary?.grossSales || 0;
    baselineSellerNet = sellerAnalytics.summary?.netEarnings || 0;
    baselineSellerOrders = sellerAnalytics.summary?.totalOrders || 0;

    const adminMetricsRes = await app.request("/api/admin/metrics", {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminMetrics = await adminMetricsRes.json();
    baselineAdminGmv = adminMetrics.metrics?.gmv || 0;
    baselineAdminPlatformRevenue = adminMetrics.metrics?.platformRevenue || 0;
  });

  afterAll(async () => {
    // Cleanup records created during tests
    if (product?.id) {
      const orderItems = await db.orderItem.findMany({
        where: { productId: product.id },
        select: { subOrderId: true },
      });
      const subOrderIds = orderItems.map((oi) => oi.subOrderId);

      if (subOrderIds.length > 0) {
        await db.payoutRecord.deleteMany({ where: { subOrderId: { in: subOrderIds } } });
        await db.orderItem.deleteMany({ where: { subOrderId: { in: subOrderIds } } });
        const subOrders = await db.subOrder.findMany({
          where: { id: { in: subOrderIds } },
          select: { orderId: true },
        });
        await db.subOrder.deleteMany({ where: { id: { in: subOrderIds } } });
        const orderIds = subOrders.map((so) => so.orderId);
        if (orderIds.length > 0) {
          await db.order.deleteMany({ where: { id: { in: orderIds } } });
        }
      }

      await db.productImage.deleteMany({ where: { productId: product.id } });
      await db.product.delete({ where: { id: product.id } }).catch(() => {});
    }

    if (category?.id) {
      await db.category.delete({ where: { id: category.id } }).catch(() => {});
    }
    if (sellerProfile?.id) {
      await db.sellerProfile.delete({ where: { id: sellerProfile.id } }).catch(() => {});
    }
    if (sellerUser?.id) {
      await db.user.delete({ where: { id: sellerUser.id } }).catch(() => {});
    }
    if (buyerUser?.id) {
      await db.user.delete({ where: { id: buyerUser.id } }).catch(() => {});
    }
    if (adminUser?.id) {
      await db.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    }
  });

  let createdParentOrderId: string;
  let createdSubOrderId: string;
  let stripeSessionId: string;

  // --------------------------------------------------------------------------
  // Phase 1: Checkout & Unpaid Order Isolation (Issue 1)
  // --------------------------------------------------------------------------
  it("Phase 1: Checkout reserves inventory, creates PAYMENT_PENDING order, and does NOT create a PayoutRecord", async () => {
    const res = await app.request("/api/orders/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 2 }],
        shippingAddress: {
          fullName: "Lifecycle Buyer",
          addressLine: "123 Test Street",
          city: "Test City",
          state: "Test State",
          postalCode: "123456",
          country: "India",
        },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.orderId).toBeDefined();
    expect(body.stripeSessionId).toBeDefined();

    createdParentOrderId = body.orderId;
    stripeSessionId = body.stripeSessionId;

    // Verify product inventory was decremented from 10 to 8
    const updatedProd = await db.product.findUnique({ where: { id: product.id } });
    expect(updatedProd?.inventoryCount).toBe(8);

    // Verify parent order status is PAYMENT_PENDING
    const parentOrder = await db.order.findUnique({
      where: { id: createdParentOrderId },
      include: { subOrders: true },
    });
    expect(parentOrder?.paymentStatus).toBe("PAYMENT_PENDING");
    expect(parentOrder?.subOrders.length).toBe(1);

    createdSubOrderId = parentOrder!.subOrders[0].id;

    // CRITICAL (Issue 1): PayoutRecord must NOT be created at checkout time
    const payouts = await db.payoutRecord.findMany({
      where: { subOrderId: createdSubOrderId },
    });
    expect(payouts.length).toBe(0);
  });

  it("Phase 1: Unpaid orders do NOT appear in seller orders and sellers CANNOT mark them SHIPPED", async () => {
    // 1. Unpaid sub-order must not appear in seller orders
    const sellerOrdersRes = await app.request("/api/orders/seller-orders", {
      method: "GET",
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    expect(sellerOrdersRes.status).toBe(200);
    const sellerOrdersData = await sellerOrdersRes.json();
    const matchingOrder = sellerOrdersData.subOrders.find(
      (so: any) => so.id === createdSubOrderId
    );
    expect(matchingOrder).toBeUndefined();

    // 2. Seller attempt to fulfill/ship unpaid sub-order must return 400
    const shipRes = await app.request(`/api/orders/seller-orders/${createdSubOrderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({ status: "SHIPPED" }),
    });
    expect(shipRes.status).toBe(400);
    const shipBody = await shipRes.json();
    expect(shipBody.error).toMatch(/Cannot fulfill or update status for an unpaid order/i);
  });

  it("Phase 1: Unpaid orders do NOT count toward seller analytics or admin revenue", async () => {
    // Seller analytics should show no change in gross sales, net earnings, or orders
    const sellerAnalyticsRes = await app.request("/api/analytics/seller", {
      method: "GET",
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    expect(sellerAnalyticsRes.status).toBe(200);
    const sellerAnalytics = await sellerAnalyticsRes.json();
    expect(sellerAnalytics.summary.grossSales - baselineSellerGross).toBe(0);
    expect(sellerAnalytics.summary.netEarnings - baselineSellerNet).toBe(0);
    expect(sellerAnalytics.summary.totalOrders - baselineSellerOrders).toBe(0);

    // Admin metrics should show 0 GMV and 0 platform revenue increase for this unpaid order
    const adminMetricsRes = await app.request("/api/admin/metrics", {
      method: "GET",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(adminMetricsRes.status).toBe(200);
    const adminMetrics = await adminMetricsRes.json();
    expect(adminMetrics.metrics.gmv - baselineAdminGmv).toBe(0);
    expect(adminMetrics.metrics.platformRevenue - baselineAdminPlatformRevenue).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Phase 2: Payment Confirmation (`markOrderPaid`)
  // --------------------------------------------------------------------------
  it("Phase 2: Payment confirmation transitions order to PAID and creates a PENDING PayoutRecord", async () => {
    const paymentIntentId = "pi_mock_lifecycle_123";
    const paid = await markOrderPaid(createdParentOrderId, stripeSessionId, paymentIntentId);
    expect(paid).toBe(true);

    // Verify order in DB is now PAID
    const order = await db.order.findUnique({ where: { id: createdParentOrderId } });
    expect(order?.paymentStatus).toBe("PAID");
    expect(order?.stripePaymentIntentId).toBe(paymentIntentId);

    // Verify PayoutRecord is now created with status PENDING
    const payouts = await db.payoutRecord.findMany({
      where: { subOrderId: createdSubOrderId },
    });
    expect(payouts.length).toBe(1);
    expect(payouts[0].status).toBe("PENDING");
    // ₹200 subtotal - 10% commission (₹20) = ₹180 payout
    expect(Number(payouts[0].amount)).toBe(180);

    // Sub-order should now appear in seller queue
    const sellerOrdersRes = await app.request("/api/orders/seller-orders", {
      method: "GET",
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    const sellerOrdersData = await sellerOrdersRes.json();
    const matchingOrder = sellerOrdersData.subOrders.find(
      (so: any) => so.id === createdSubOrderId
    );
    expect(matchingOrder).toBeDefined();

    // Seller analytics should now reflect the paid order (delta +₹200 gross, +₹180 net)
    const sellerAnalyticsRes = await app.request("/api/analytics/seller", {
      method: "GET",
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    const sellerAnalytics = await sellerAnalyticsRes.json();
    expect(sellerAnalytics.summary.grossSales - baselineSellerGross).toBe(200);
    expect(sellerAnalytics.summary.netEarnings - baselineSellerNet).toBe(180);
    expect(sellerAnalytics.summary.totalOrders - baselineSellerOrders).toBe(1);
  });

  // --------------------------------------------------------------------------
  // Phase 3: Cancellation, Restock, and Refund (Issue 2)
  // --------------------------------------------------------------------------
  it("Phase 3: Cancelling a paid order triggers a Stripe refund, restocks inventory, sets payout to FAILED, and marks sub-order REFUNDED", async () => {
    mockRefundCreate.mockClear();

    const cancelRes = await app.request(`/api/orders/seller-orders/${createdSubOrderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sellerToken}`,
      },
      body: JSON.stringify({ status: "CANCELLED" }),
    });

    expect(cancelRes.status).toBe(200);
    const cancelBody = await cancelRes.json();
    expect(cancelBody.subOrder.status).toBe("REFUNDED");

    // 1. Verify Stripe refund was called with payment_intent and suborder amount in cents (₹200 = 20000)
    expect(mockRefundCreate).toHaveBeenCalledTimes(1);
    expect(mockRefundCreate).toHaveBeenCalledWith({
      payment_intent: "pi_mock_lifecycle_123",
      amount: 20000,
    });

    // 2. Verify product inventory was restocked (8 + 2 = 10)
    const restockedProd = await db.product.findUnique({ where: { id: product.id } });
    expect(restockedProd?.inventoryCount).toBe(10);

    // 3. Verify PayoutRecord was voided to FAILED
    const payout = await db.payoutRecord.findUnique({
      where: { subOrderId: createdSubOrderId },
    });
    expect(payout?.status).toBe("FAILED");

    // 4. Verify parent order remains PAID rather than broken
    const parentOrder = await db.order.findUnique({ where: { id: createdParentOrderId } });
    expect(parentOrder?.paymentStatus).toBe("PAID");
  });

  // --------------------------------------------------------------------------
  // Phase 4: Payout Disbursal State Machine & Double-Payout Guard (Issue 3)
  // --------------------------------------------------------------------------
  it("Phase 4: Cannot disburse a FAILED payout, and cannot disburse a PENDING payout twice", async () => {
    const failedPayout = await db.payoutRecord.findUnique({
      where: { subOrderId: createdSubOrderId },
    });
    expect(failedPayout?.status).toBe("FAILED");

    // 1. Attempt to disburse a FAILED payout must return 400
    const disburseFailedRes = await app.request(`/api/admin/payouts/${failedPayout!.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "TRANSFERRED" }),
    });
    expect(disburseFailedRes.status).toBe(400);
    const disburseFailedBody = await disburseFailedRes.json();
    expect(disburseFailedBody.error).toMatch(/Cannot disburse payout: current status is "FAILED"/i);

    // 2. Create a second fresh order, pay it, and verify valid disbursal
    const checkout2Res = await app.request("/api/orders/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        items: [{ productId: product.id, quantity: 1 }],
        shippingAddress: {
          fullName: "Lifecycle Buyer 2",
          addressLine: "456 Test Avenue",
          city: "Test City",
          state: "Test State",
          postalCode: "123456",
          country: "India",
        },
      }),
    });
    expect(checkout2Res.status).toBe(201);
    const checkout2Body = await checkout2Res.json();

    await markOrderPaid(checkout2Body.orderId, checkout2Body.stripeSessionId, "pi_mock_lifecycle_456");

    const order2 = await db.order.findUnique({
      where: { id: checkout2Body.orderId },
      include: { subOrders: true },
    });
    const subOrder2Id = order2!.subOrders[0].id;
    const validPayout = await db.payoutRecord.findUnique({
      where: { subOrderId: subOrder2Id },
    });
    expect(validPayout?.status).toBe("PENDING");

    // First disbursal: PENDING -> TRANSFERRED succeeds
    const disburseRes = await app.request(`/api/admin/payouts/${validPayout!.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "TRANSFERRED" }),
    });
    expect(disburseRes.status).toBe(200);
    const disburseBody = await disburseRes.json();
    expect(disburseBody.payout.status).toBe("TRANSFERRED");

    // Second disbursal attempt on the same payout must return 400 (Double payout prevented!)
    const doubleDisburseRes = await app.request(`/api/admin/payouts/${validPayout!.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ status: "TRANSFERRED" }),
    });
    expect(doubleDisburseRes.status).toBe(400);
    const doubleDisburseBody = await doubleDisburseRes.json();
    expect(doubleDisburseBody.error).toMatch(/Cannot disburse payout: current status is "TRANSFERRED"/i);
  });
});
