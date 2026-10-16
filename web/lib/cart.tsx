"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import type { ProductHit } from "./api";

const KEY = "lmc_cart_v1";
const MAX_QTY = 20;

export type CartItem = { product: ProductHit; quantity: number };

type CartValue = {
  items: CartItem[];
  count: number;
  total: number;
  has: (productId: string) => boolean;
  add: (product: ProductHit) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  /** Replace the saved snapshots with fresh catalog data; drops products that no longer exist. */
  sync: (fresh: ProductHit[]) => void;
};

const CartContext = createContext<CartValue | null>(null);

const listeners = new Set<() => void>();
let cache: { raw: string | null; items: CartItem[] } = { raw: null, items: [] };
const EMPTY: CartItem[] = [];

function readItems(): CartItem[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return cache.items;
  }
  if (raw === cache.raw) return cache.items;
  let items: CartItem[] = [];
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) items = parsed.filter((i) => i?.product?.product_id && i.quantity > 0);
  } catch {
    // corrupt value: start with an empty cart
  }
  cache = { raw, items };
  return items;
}

function writeItems(items: CartItem[]) {
  const raw = JSON.stringify(items);
  cache = { raw, items };
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    // storage blocked: the cart still works for this visit
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => e.key === KEY && cb(); // another tab changed the cart
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

const clamp = (q: number, stock: number) => Math.max(1, Math.min(q, MAX_QTY, Math.max(1, stock)));

export function CartProvider({ children }: { children: React.ReactNode }) {
  const items = useSyncExternalStore(subscribe, readItems, () => EMPTY);
  const update = useCallback((fn: (cur: CartItem[]) => CartItem[]) => writeItems(fn(readItems())), []);

  const add = useCallback((product: ProductHit) => {
    update((cur) => {
      const found = cur.find((i) => i.product.product_id === product.product_id);
      if (!found) return [...cur, { product, quantity: 1 }];
      return cur.map((i) => (i === found ? { product, quantity: clamp(i.quantity + 1, product.stock) } : i));
    });
  }, [update]);

  const setQuantity = useCallback((id: string, quantity: number) => {
    update((cur) => cur.map((i) => (i.product.product_id === id ? { ...i, quantity: clamp(quantity, i.product.stock) } : i)));
  }, [update]);

  const remove = useCallback((id: string) => update((cur) => cur.filter((i) => i.product.product_id !== id)), [update]);

  const sync = useCallback((fresh: ProductHit[]) => {
    const byId = new Map(fresh.map((p) => [p.product_id, p]));
    update((cur) =>
      cur.flatMap((i) => {
        const p = byId.get(i.product.product_id);
        return p ? [{ product: p, quantity: clamp(i.quantity, p.stock) }] : [];
      }),
    );
  }, [update]);

  const value = useMemo<CartValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      total: Math.round(items.reduce((n, i) => n + i.product.price * i.quantity, 0) * 100) / 100,
      has: (id) => items.some((i) => i.product.product_id === id),
      add,
      setQuantity,
      remove,
      sync,
    }),
    [items, add, setQuantity, remove, sync],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
