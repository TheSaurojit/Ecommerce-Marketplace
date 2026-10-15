"use client";

import React, { createContext, startTransition, useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { client } from "@/lib/rpc";

export const MAX_CART_QUANTITY = 99;

export interface CartItem {
  productId: string;
  title: string;
  slug: string;
  price: number;
  quantity: number;
  imageUrl: string;
  sellerId: string;
  storeName: string;
}

export interface SellerCartGroup {
  sellerId: string;
  storeName: string;
  items: CartItem[];
  subtotal: number;
}

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === "string" &&
    typeof item.title === "string" &&
    typeof item.slug === "string" &&
    typeof item.price === "number" &&
    Number.isFinite(item.price) &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    typeof item.imageUrl === "string" &&
    typeof item.sellerId === "string" &&
    typeof item.storeName === "string"
  );
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  revalidatePrices: () => Promise<void>;
  itemCount: number;
  totalAmount: number;
  groupedBySeller: SellerCartGroup[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Revalidate cart item prices with fresh database values
  const revalidatePrices = useCallback(async (currentItems?: CartItem[]) => {
    const listToRevalidate = currentItems || items;
    if (!listToRevalidate.length) return;

    try {
      const refreshed = await Promise.all(
        listToRevalidate.map(async (item) => {
          try {
            const res = await client.api.products.slug[":slug"].$get({
              param: { slug: item.slug },
            });
            if (res.ok) {
              const data = await res.json();
              if (data.product) {
                return {
                  ...item,
                  price: Number(data.product.price),
                  title: data.product.title,
                  imageUrl: data.product.images?.[0]?.url || item.imageUrl,
                };
              }
            }
          } catch {
            // Ignore individual fetch failure
          }
          return item;
        })
      );
      startTransition(() => setItems(refreshed));
    } catch {
      // Ignore
    }
  }, [items]);
  const revalidatePricesRef = useRef(revalidatePrices);

  // Load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("marketplace_cart");
      if (saved) {
        const parsedValue: unknown = JSON.parse(saved);
        const parsed = Array.isArray(parsedValue) ? parsedValue.filter(isCartItem) : [];
        startTransition(() => setItems(parsed));
        // Refresh prices upon hydration
        void revalidatePricesRef.current(parsed);
      }
    } catch (err) {
      console.warn("Failed to load cart from localStorage:", err);
    }
    startTransition(() => setHydrated(true));
  }, []);

  // Save to local storage
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem("marketplace_cart", JSON.stringify(items));
    }
  }, [items, hydrated]);

  // Listen for storage clear event (e.g. cross-tab or logout)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "marketplace_cart" && !e.newValue) {
        setItems([]);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const addItem = useCallback((newItem: Omit<CartItem, "quantity">, quantity = 1) => {
    const boundedQuantity = Math.max(1, Math.min(MAX_CART_QUANTITY, quantity));

    setItems((prev) => {
      const existing = prev.find((i) => i.productId === newItem.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === newItem.productId
            ? {
                ...i,
                quantity: Math.min(MAX_CART_QUANTITY, i.quantity + boundedQuantity),
                price: newItem.price, // ensure fresh price on add
              }
            : i
        );
      }
      return [...prev, { ...newItem, quantity: boundedQuantity }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    const clampedQuantity = Math.min(MAX_CART_QUANTITY, quantity);
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: clampedQuantity } : i))
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("marketplace_cart");
    }
  }, []);

  const itemCount = useMemo(
    () => items.reduce((acc, item) => acc + item.quantity, 0),
    [items]
  );

  const totalAmount = useMemo(
    () =>
      Number(
        items.reduce((acc, item) => acc + item.price * item.quantity, 0).toFixed(2)
      ),
    [items]
  );

  const groupedBySeller = useMemo(() => {
    const map = new Map<string, SellerCartGroup>();
    for (const item of items) {
      if (!map.has(item.sellerId)) {
        map.set(item.sellerId, {
          sellerId: item.sellerId,
          storeName: item.storeName,
          items: [],
          subtotal: 0,
        });
      }
      const group = map.get(item.sellerId)!;
      group.items.push(item);
      group.subtotal = Number((group.subtotal + item.price * item.quantity).toFixed(2));
    }
    return Array.from(map.values());
  }, [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        revalidatePrices,
        itemCount,
        totalAmount,
        groupedBySeller,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
