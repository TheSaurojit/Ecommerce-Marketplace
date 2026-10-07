import { hc } from "hono/client";
import type { AppType } from "@/server";

const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
};

export const client = hc<AppType>(getBaseUrl(), {
  init: {
    credentials: "include",
  },
});
