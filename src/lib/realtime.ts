import { EventEmitter } from "node:events";
import { supabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase";

const globalForRealtime = globalThis as unknown as {
  realtimeBus?: EventEmitter;
};

export const realtimeBus = globalForRealtime.realtimeBus ?? new EventEmitter();
realtimeBus.setMaxListeners(200);

if (process.env.NODE_ENV !== "production") {
  globalForRealtime.realtimeBus = realtimeBus;
}

export interface RealtimeMessage {
  topic: string;
  event: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

/**
 * Broadcast an event to both the local in-process SSE bus and the Supabase Realtime channel.
 * Guarantees zero-dependency, 100% reliable local real-time delivery even when offline.
 */
export function broadcastRealtimeEvent(
  topic: string,
  event: string,
  payload: Record<string, unknown>
): void {
  const message: RealtimeMessage = {
    topic,
    event,
    payload,
    timestamp: new Date().toISOString(),
  };

  // 1. In-process event bus for local SSE streaming (reliable in all environments)
  realtimeBus.emit("message", message);
  realtimeBus.emit(topic, message);

  // 2. Primary Distributed Transport: Publish to Supabase Realtime Private Channel
  if (isSupabaseAdminConfigured() && supabaseAdmin) {
    try {
      const channel = supabaseAdmin.channel(topic, {
        config: {
          private: true,
        },
      });

      const chAny = channel as unknown as { httpSend?: (event: string, payload: unknown) => Promise<unknown> };
      const sendPromise = typeof chAny.httpSend === "function"
        ? chAny.httpSend(event, message)
        : channel.send({
            type: "broadcast",
            event,
            payload: message,
          });

      sendPromise.catch((err: unknown) => {
        const errorRecord = typeof err === "object" && err !== null ? (err as Record<string, unknown>) : null;
        console.warn(`[Realtime Broadcast Error on ${topic}]:`, errorRecord?.message || err);
      });
    } catch (err) {
      console.warn(`[Realtime Channel Error on ${topic}]:`, err);
    }
  }
}
