"use client";

import React, { createContext, startTransition, useContext, useEffect, useState, useCallback } from "react";

export interface UserSession {
  id: string;
  name: string | null;
  email: string;
  role: "BUYER" | "SELLER" | "ADMIN";
  image?: string | null;
  sellerProfile?: {
    id: string;
    storeName: string;
    storeSlug: string;
    status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "SUSPENDED";
    logoUrl?: string | null;
    bannerUrl?: string | null;
    commissionRate: number;
  } | null;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: "BUYER" | "SELLER";
  storeName?: string;
  storeDescription?: string;
}

interface AuthContextType {
  user: UserSession | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; user?: UserSession }>;
  register: (data: RegisterInput) => Promise<{ success: boolean; error?: string; user?: UserSession }>;
  logout: () => Promise<void>;
}

import { client } from "@/lib/rpc";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await client.api.auth.me.$get();
      if (res.ok) {
        const data = await res.json();
        startTransition(() => setUser(data.user as UserSession | null));
      } else {
        startTransition(() => setUser(null));
      }
    } catch {
      startTransition(() => setUser(null));
    } finally {
      startTransition(() => setLoading(false));
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    try {
      const res = await client.api.auth.login.$post({
        json: { email, password },
      });
      const data = await res.json();
      if (res.ok && "user" in data) {
        await refreshUser();
        return { success: true, user: data.user as UserSession };
      }
      return {
        success: false,
        error: "error" in data && typeof data.error === "string" ? data.error : "Invalid email or password",
      };
    } catch {
      return { success: false, error: "Network error occurred during login" };
    }
  };

  const register = async (data: RegisterInput) => {
    try {
      const res = await client.api.auth.register.$post({
        json: data,
      });
      const resData = await res.json();
      if (res.ok && "user" in resData) {
        await refreshUser();
        return { success: true, user: resData.user as UserSession };
      }
      return {
        success: false,
        error: "error" in resData && typeof resData.error === "string" ? resData.error : "Failed to create account",
      };
    } catch {
      return { success: false, error: "Network error occurred during registration" };
    }
  };

  const logout = async () => {
    try {
      await client.api.auth.logout.$post();
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("marketplace_cart");
    }
    setUser(null);
    window.location.assign(new URL("/login", window.location.origin));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refreshUser,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
