import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getCookie } from "hono/cookie";
import { realtimeBus, RealtimeMessage } from "@/lib/realtime";
import { verifySession, COOKIE_NAME } from "../auth";

export const realtimeRoutes = new Hono().get("/events", async (c) => {
  const topicsParam = c.req.query("topics") || c.req.query("topic") || "";
  const requestedTopics = topicsParam
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  // Authenticate from cookie or Authorization header or query param
  const cookieToken = getCookie(c, COOKIE_NAME);
  const authHeader = c.req.header("Authorization");
  const bearerToken = authHeader?.replace(/^Bearer\s+/i, "");
  const queryToken = c.req.query("token");

  const rawToken = cookieToken || bearerToken || queryToken;

  let authenticatedUserId: string | null = null;
  let authenticatedSellerId: string | null = null;
  let isAdmin = false;

  if (rawToken) {
    const session = await verifySession(rawToken);
    if (session) {
      authenticatedUserId = session.userId;
      authenticatedSellerId = session.sellerProfileId ?? null;
      isAdmin = session.role === "ADMIN";
    }
  }

  // Filter topics based on permissions
  const allowedTopics = requestedTopics.filter((topic) => {
    // Public product inventory topic
    if (topic.startsWith("product:stock:")) return true;

    // Buyer-specific order topic
    if (topic.startsWith("buyer:orders:")) {
      const targetUserId = topic.split(":")[2];
      return isAdmin || (authenticatedUserId !== null && authenticatedUserId === targetUserId);
    }

    // Seller-specific order topic
    if (topic.startsWith("seller:orders:")) {
      const targetSellerId = topic.split(":")[2];
      return isAdmin || (authenticatedSellerId !== null && authenticatedSellerId === targetSellerId);
    }

    // Admin alerts
    if (topic === "admin:alerts") {
      return isAdmin;
    }

    return false;
  });

  return streamSSE(c, async (stream) => {
    // 1. Initial connection confirmation
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({
        status: "connected",
        topics: allowedTopics,
        timestamp: new Date().toISOString(),
      }),
    });

    // 2. Event listener for matching topics
    const messageHandler = async (msg: RealtimeMessage) => {
      if (allowedTopics.includes(msg.topic)) {
        try {
          await stream.writeSSE({
            event: msg.event,
            data: JSON.stringify({
              topic: msg.topic,
              payload: msg.payload,
              timestamp: msg.timestamp,
            }),
          });
        } catch {
          // Stream might have closed
        }
      }
    };

    realtimeBus.on("message", messageHandler);

    // 3. Heartbeat keepalive ping every 25 seconds
    const heartbeat = setInterval(async () => {
      try {
        await stream.writeSSE({
          event: "ping",
          data: JSON.stringify({ time: Date.now() }),
        });
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);

    // 4. Cleanup on disconnect
    stream.onAbort(() => {
      clearInterval(heartbeat);
      realtimeBus.off("message", messageHandler);
    });

    // 5. Keep connection open while client is connected
    while (!stream.aborted) {
      await stream.sleep(1000);
    }
  });
});
