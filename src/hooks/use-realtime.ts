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

    let isCancelled = false;
    let eventSource: EventSource | null = null;
    const activeChannels: RealtimeChannel[] = [];

    // 1. Primary Distributed Transport: Supabase Realtime with Private Channels (Vercel / Serverless Ready)
    if (isSupabaseConfigured() && supabase) {
      const client = supabase;

      const initSupabaseRealtime = async () => {
        // Check if any topic requires user authentication
        const hasAuthTopic = validTopics.some(
          (t) => t.startsWith("buyer:") || t.startsWith("seller:") || t.startsWith("admin:")
        );

        if (hasAuthTopic) {
          try {
            const res = await fetch("/api/realtime/token", {
              credentials: "include",
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.token && !isCancelled) {
                await client.realtime.setAuth(data.token);
              }
            }
          } catch (err) {
            console.warn("[Realtime Auth Token Error]:", err);
          }
        }

        if (isCancelled) return;

        validTopics.forEach((topic) => {
          try {
            const ch = client
              .channel(topic, {
                config: {
                  private: true,
                  broadcast: { self: false },
                },
              })
              .on("broadcast", { event: "*" }, (response) => {
                const eventName = response.event;
                const payload = (response.payload as Record<string, unknown>) || {};
                onEventRef.current(eventName, payload);
              })
              .subscribe((status) => {
                if (status === "CHANNEL_ERROR") {
                  console.warn(`[Supabase Realtime] Authorization denied or channel error on: ${topic}`);
                }
              });

            activeChannels.push(ch);
          } catch (err) {
            console.warn(`[Supabase Realtime Channel Error on ${topic}]:`, err);
          }
        });
      };

      void initSupabaseRealtime();
    } else {
      // 2. Fallback: Native Browser EventSource (SSE) for Local Dev without Supabase
      const sseUrl = `/api/realtime/events?topics=${encodeURIComponent(validTopics.join(","))}`;
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
    }

    return () => {
      isCancelled = true;
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
