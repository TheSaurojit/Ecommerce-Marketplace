"use client";

import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface RealtimeEventData {
  topic?: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
  [key: string]: unknown;
}

export interface UseRealtimeOptions {
  topics: (string | null | undefined)[];
  onEvent: (event: string, data: RealtimeEventData) => void;
  enabled?: boolean;
}

/**
 * Universal Real-Time Subscription Hook
 * Subscribes to Server-Sent Events (SSE) from the local Next.js/Hono API
 * and optionally bridges to Supabase Realtime Channels when configured.
 */
export function useRealtimeSubscription({
  topics,
  onEvent,
  enabled = true,
}: UseRealtimeOptions): void {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  // Compute stable topics key
  const topicsKey = topics
    .filter((t): t is string => Boolean(t && t.trim().length > 0))
    .sort()
    .join(",");

  useEffect(() => {
    if (!enabled || !topicsKey || typeof window === "undefined") {
      return;
    }

    const validTopics = topicsKey.split(",").filter(Boolean);
    if (validTopics.length === 0) return;

    // 1. Primary: Native Browser EventSource (SSE) to /api/realtime/events
    const sseUrl = `/api/realtime/events?topics=${encodeURIComponent(validTopics.join(","))}`;
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(sseUrl, { withCredentials: true });

      // Handle standard message
      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          onEventRef.current("message", parsed);
        } catch {
          // ignore parse errors
        }
      };

      // Supported custom event types
      const knownEvents = [
        "order:status_updated",
        "order:paid",
        "order:new",
        "order:cancelled",
        "stock:updated",
        "product:sold_out",
        "connected",
      ];

      knownEvents.forEach((eventName) => {
        eventSource?.addEventListener(eventName, (e: MessageEvent) => {
          try {
            const parsed = JSON.parse(e.data);
            onEventRef.current(eventName, parsed);
          } catch {
            // ignore
          }
        });
      });
    } catch (err) {
      console.warn("[Realtime SSE Connection Error]:", err);
    }

    // 2. Secondary: Supabase Realtime Channels (if Supabase is configured and active)
    const activeChannels: RealtimeChannel[] = [];
    if (isSupabaseConfigured() && supabase) {
      const client = supabase;
      validTopics.forEach((topic) => {
        try {
          const ch = client
            .channel(topic)
            .on("broadcast", { event: "*" }, (response) => {
              const eventName = response.event;
              const payload = (response.payload as Record<string, unknown>) || {};
              onEventRef.current(eventName, payload);
            })
            .subscribe();
          activeChannels.push(ch);
        } catch {
          // safe no-op if Supabase channel fails
        }
      });
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (supabase && activeChannels.length > 0) {
        const client = supabase;
        activeChannels.forEach((ch) => {
          try {
            client.removeChannel(ch);
          } catch {
            // ignore
          }
        });
      }
    };
  }, [topicsKey, enabled]);
}
