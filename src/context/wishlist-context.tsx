"use client";

import React, { createContext, startTransition, useContext, useEffect, useState } from "react";

export interface WishlistItem {
  id: string; // productId
  title: string;
  slug: string;
  price: number;
  comparePrice?: number | null;
  imageUrl: string;
  sellerId: string;
  storeName: string;
  storeSlug?: string;
  inStock?: boolean;
}

interface WishlistContextType {
  items: WishlistItem[];
  count: number;
  addItem: (item: WishlistItem) => void;
  removeItem: (productId: string) => void;
  toggleItem: (item: WishlistItem) => void;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const STORAGE_KEY = "markethub_wishlist";

function isWishlistItem(value: unknown): value is WishlistItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.slug === "string" &&
    typeof item.price === "number" &&
    Number.isFinite(item.price) &&
    typeof item.imageUrl === "string" &&
    typeof item.sellerId === "string" &&
    typeof item.storeName === "string"
  );
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        const validItems = Array.isArray(parsed) ? parsed.filter(isWishlistItem) : [];
        startTransition(() => setItems(validItems));
      }
    } catch (err) {
      console.warn("Failed to load wishlist from localStorage:", err);
    } finally {
      startTransition(() => setInitialized(true));
    }
  }, []);

  useEffect(() => {
    if (initialized) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (err) {
        console.warn("Failed to save wishlist to localStorage:", err);
      }
    }
  }, [items, initialized]);

  const addItem = (item: WishlistItem) => {
    setItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== productId));
  };

  const toggleItem = (item: WishlistItem) => {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      if (exists) {
        return prev.filter((i) => i.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const isInWishlist = (productId: string) => {
    return items.some((i) => i.id === productId);
  };

  const clearWishlist = () => {
    setItems([]);
  };

  return (
    <WishlistContext.Provider
      value={{
        items,
        count: items.length,
        addItem,
        removeItem,
        toggleItem,
        isInWishlist,
        clearWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
