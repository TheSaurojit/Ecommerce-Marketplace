/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from "vitest";
import { app } from "@/server";
import { realtimeBus, broadcastRealtimeEvent } from "@/lib/realtime";
import { signSession } from "@/server/auth";

describe("Real-Time Event Streaming & Broadcast Hub", () => {
  beforeEach(() => {
    realtimeBus.removeAllListeners();
  });

  it("1. broadcastRealtimeEvent correctly dispatches events to the in-process realtimeBus", async () => {
    const receivedMessages: any[] = [];
    const topic = "product:stock:test_prod_1";

    realtimeBus.on("message", (msg) => {
      receivedMessages.push(msg);
    });

    broadcastRealtimeEvent(topic, "stock:updated", {
      productId: "test_prod_1",
      delta: -2,
    });

    expect(receivedMessages.length).toBe(1);
    expect(receivedMessages[0].topic).toBe(topic);
    expect(receivedMessages[0].event).toBe("stock:updated");
    expect(receivedMessages[0].payload).toEqual({
      productId: "test_prod_1",
      delta: -2,
    });
    expect(receivedMessages[0].timestamp).toBeDefined();
  });

  it("2. GET /api/realtime/events opens an SSE stream with text/event-stream content type", async () => {
    const res = await app.request("/api/realtime/events?topics=product:stock:item_123", {
      method: "GET",
    });

    expect(res.status).toBe(200);
    const contentType = res.headers.get("content-type") || "";
    expect(contentType).toContain("text/event-stream");

    // Read the first chunk from the SSE stream
    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const chunk = await reader?.read();
    const text = new TextDecoder().decode(chunk?.value);

    // Initial connected event should be emitted
    expect(text).toContain("event: connected");
    expect(text).toContain('"status":"connected"');
    expect(text).toContain("product:stock:item_123");

    // Close stream reader
    await reader?.cancel();
  });

  it("3. Enforces authorization on protected topics (buyer and seller isolation)", async () => {
    const buyerUserId = "user_buyer_999";
    const otherBuyerUserId = "user_buyer_888";

    const buyerToken = await signSession({
      userId: buyerUserId,
      email: "buyer999@test.com",
      role: "BUYER",
    });

    // Attempting to subscribe to another user's buyer topic without credentials
    const unauthRes = await app.request(
      `/api/realtime/events?topics=buyer:orders:${buyerUserId},product:stock:open_prod`,
      { method: "GET" }
    );
    expect(unauthRes.status).toBe(200);
    const unauthReader = unauthRes.body?.getReader();
    const unauthChunk = await unauthReader?.read();
    const unauthText = new TextDecoder().decode(unauthChunk?.value);

    // Only public product:stock is allowed; unauthenticated buyer topic is stripped out
    expect(unauthText).toContain("product:stock:open_prod");
    expect(unauthText).not.toContain(`buyer:orders:${buyerUserId}`);
    await unauthReader?.cancel();

    // With authentic user token: allowed for own topic
    const authRes = await app.request(
      `/api/realtime/events?topics=buyer:orders:${buyerUserId},buyer:orders:${otherBuyerUserId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${buyerToken}`,
        },
      }
    );
    expect(authRes.status).toBe(200);
    const authReader = authRes.body?.getReader();
    const authChunk = await authReader?.read();
    const authText = new TextDecoder().decode(authChunk?.value);

    // Own topic is allowed; other buyer's topic is filtered out
    expect(authText).toContain(`buyer:orders:${buyerUserId}`);
    expect(authText).not.toContain(`buyer:orders:${otherBuyerUserId}`);
    await authReader?.cancel();
  });

  it("4. SSE stream pushes live events when broadcastRealtimeEvent is called", async () => {
    const res = await app.request("/api/realtime/events?topics=product:stock:p_live", {
      method: "GET",
    });

    const reader = res.body?.getReader();
    // Read the initial "connected" event
    await reader?.read();

    // Broadcast an inventory event
    setTimeout(() => {
      broadcastRealtimeEvent("product:stock:p_live", "stock:updated", {
        productId: "p_live",
        delta: 5,
        newInventoryCount: 15,
      });
    }, 50);

    // Read the streamed event
    const liveChunk = await reader?.read();
    const liveText = new TextDecoder().decode(liveChunk?.value);

    expect(liveText).toContain("event: stock:updated");
    expect(liveText).toContain('"productId":"p_live"');
    expect(liveText).toContain('"delta":5');
    expect(liveText).toContain('"newInventoryCount":15');

    await reader?.cancel();
  });
});
