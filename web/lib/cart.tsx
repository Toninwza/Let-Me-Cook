"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CartLine, DEMO_USER_ID, ProductHit, getCart, removeCartItem, setCartItem } from "./api";

const MAX_QTY = 20;

export type CartItem = CartLine;

type CartValue = {
  items: CartItem[];
  count: number;
  total: number;
  add: (product: ProductHit) => void;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  /** Read the cart from the server again (prices and stock are joined from the catalog there). */
  refresh: () => Promise<void>;
};

const CartContext = createContext<CartValue | null>(null);

const clamp = (q: number, stock: number) => Math.max(1, Math.min(q, MAX_QTY, Math.max(1, stock)));

/** The cart lives in the DB (GET/PUT/DELETE /api/users/{id}/cart). Edits show at once and the
 *  server's answer replaces them; if a call fails the cart is read again. */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const itemsRef = useRef(items);
  // Edits sent but not answered yet: a stale GET must not overwrite the screen meanwhile.
  const pending = useRef(0);

  const apply = useCallback((next: CartItem[]) => {
    itemsRef.current = next;
    setItems(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const fresh = await getCart(DEMO_USER_ID);
      if (pending.current === 0) apply(fresh);
    } catch {
      // offline or API down: keep what is on screen
    }
  }, [apply]);

  useEffect(() => {
    let live = true;
    getCart(DEMO_USER_ID)
      .then((fresh) => live && pending.current === 0 && apply(fresh))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [apply]);

  const mutate = useCallback(
    async (optimistic: CartItem[], request: () => Promise<CartItem[]>) => {
      apply(optimistic);
      pending.current += 1;
      try {
        const fresh = await request();
        if (pending.current === 1) apply(fresh);
      } catch {
        pending.current -= 1;
        await refresh();
        return;
      }
      pending.current -= 1;
    },
    [apply, refresh],
  );

  const add = useCallback(
    (product: ProductHit) => {
      const cur = itemsRef.current;
      const found = cur.find((i) => i.product.product_id === product.product_id);
      const quantity = clamp((found?.quantity ?? 0) + 1, product.stock);
      const optimistic = found
        ? cur.map((i) => (i === found ? { product, quantity } : i))
        : [...cur, { product, quantity }];
      mutate(optimistic, () => setCartItem(DEMO_USER_ID, product.product_id, quantity));
    },
    [mutate],
  );

  const setQuantity = useCallback(
    (id: string, quantity: number) => {
      const cur = itemsRef.current;
      const found = cur.find((i) => i.product.product_id === id);
      if (!found) return;
      const q = clamp(quantity, found.product.stock);
      mutate(
        cur.map((i) => (i === found ? { ...i, quantity: q } : i)),
        () => setCartItem(DEMO_USER_ID, id, q),
      );
    },
    [mutate],
  );

  const remove = useCallback(
    (id: string) => {
      mutate(
        itemsRef.current.filter((i) => i.product.product_id !== id),
        () => removeCartItem(DEMO_USER_ID, id),
      );
    },
    [mutate],
  );

  const value = useMemo<CartValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      total: Math.round(items.reduce((n, i) => n + i.product.price * i.quantity, 0) * 100) / 100,
      add,
      setQuantity,
      remove,
      refresh,
    }),
    [items, add, setQuantity, remove, refresh],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
