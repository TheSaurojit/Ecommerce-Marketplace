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

    const teardownSupabaseChannels = () => {
      if (supabase && activeChannels.length > 0) {
        while (activeChannels.length > 0) {
          const ch = activeChannels.pop();
          if (ch) {
            try {
              supabase.removeChannel(ch);
            } catch {
              // ignore
            }
          }
        }
      }
    };

    const startSSEFallback = (reason?: string) => {
      if (isCancelled || eventSource) return;
      if (reason) {
        console.warn(`[Realtime Fallback]: ${reason} -> Connecting to authenticated SSE stream (/api/realtime/events).`);
      }

      const sseUrl = `/api/realtime/events?topics=${encodeURIComponent(validTopics.join(","))}`;
      try {
        eventSource = new EventSource(sseUrl, { withCredentials: true });

        eventSource.onmessage = (e) => {
          try {
            const parsed = JSON.parse(e.data);
            onEventRef.current("message", parsed);
          } catch {
            // ignore parse errors
          }
        };

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
        console.error("[Realtime SSE Connection Error]:", err);
      }
    };

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

            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}));
              const errorMsg = errorData?.error || `HTTP ${res.status}`;
              console.warn(
                `[Realtime Auth Notice]: ${errorMsg} -> Authenticated channels routed via SSE stream (/api/realtime/events).`
              );
              teardownSupabaseChannels();
              startSSEFallback("Supabase Realtime token unavailable");
              return;
            }

            const data = await res.json();
            if (data?.token && !isCancelled) {
              try {
                await client.realtime.setAuth(data.token);
              } catch (authErr) {
                console.error("[Realtime Auth Error]: Failed to set Supabase Realtime auth token:", authErr);
                teardownSupabaseChannels();
                startSSEFallback("Supabase realtime.setAuth() rejected token signature");
                return;
              }
            }
          } catch (err) {
            console.error("[Realtime Auth Token Network Error]:", err);
            teardownSupabaseChannels();
            startSSEFallback("Network error fetching Supabase Realtime token");
            return;
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
              .subscribe((status, err) => {
                if (status === "CHANNEL_ERROR") {
                  console.error(
                    `[Supabase Realtime]: Subscription rejected for channel "${topic}". Reason:`,
                    err || "No policy match on realtime.messages"
                  );
                  // If a protected channel fails, tear down Supabase channels and activate SSE fallback to prevent message loss
                  if (topic.startsWith("buyer:") || topic.startsWith("seller:") || topic.startsWith("admin:")) {
                    teardownSupabaseChannels();
                    startSSEFallback(`Supabase private channel rejected for ${topic}`);
                  }
                }
              });

            activeChannels.push(ch);
          } catch (err) {
            console.error(`[Supabase Realtime Channel Error on ${topic}]:`, err);
            startSSEFallback(`Supabase channel exception on ${topic}`);
          }
        });
      };

      void initSupabaseRealtime();
    } else {
      // 2. Native Browser EventSource (SSE) for Local Dev without Supabase
      startSSEFallback("Supabase is not configured");
    }

    return () => {
      isCancelled = true;
      if (eventSource) {
        eventSource.close();
      }
      teardownSupabaseChannels();
    };
  }, [topicsKey, enabled]);
}
