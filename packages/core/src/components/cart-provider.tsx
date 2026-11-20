"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import {
  addItem as addItemPure,
  removeItem as removeItemPure,
  setLine as setLinePure,
  totalItems as totalItemsPure,
  updateQty as updateQtyPure,
  type Cart,
  type CartItem,
} from "../cart";

const DEFAULT_KEY = "mypet_cart";
const CART_EVENT = "mypet_cart_updated";
const EMPTY_CART: Cart = { items: [] };

type CartStore = { read: () => Cart; write: (cart: Cart) => void };
const stores = new Map<string, CartStore>();

function storeFor(key: string): CartStore {
  const existing = stores.get(key);
  if (existing) return existing;
  let cachedRaw: string | null = null;
  let cachedSnapshot: Cart = EMPTY_CART;
  const store: CartStore = {
    read() {
      let raw: string | null;
      try {
        raw = localStorage.getItem(key);
      } catch {
        raw = null;
      }
      if (raw === cachedRaw) return cachedSnapshot;
      cachedRaw = raw;
      try {
        cachedSnapshot = raw ? (JSON.parse(raw) as Cart) : EMPTY_CART;
      } catch {
        cachedSnapshot = EMPTY_CART;
      }
      return cachedSnapshot;
    },
    write(cart) {
      localStorage.setItem(key, JSON.stringify(cart));
      window.dispatchEvent(new Event(CART_EVENT));
    },
  };
  stores.set(key, store);
  return store;
}

function subscribe(callback: () => void) {
  window.addEventListener(CART_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CART_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getServerSnapshot(): Cart {
  return EMPTY_CART;
}

type CartContextValue = {
  cart: Cart;
  addItem: (product: Omit<CartItem, "qty">, qty: number) => void;
  removeItem: (id: string, campaignId?: string) => void;
  updateQty: (id: string, qty: number, campaignId?: string) => void;
  /** Define a linha sem campanha (dados + quantidade final); ver `setLine` em ../cart. */
  setLine: (product: Omit<CartItem, "qty" | "campaignId" | "campaignSlug">, qty: number) => void;
  totalItems: number;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de CartProvider");
  return ctx;
}

export function CartProvider({ children, storageKey = DEFAULT_KEY }: { children: React.ReactNode; storageKey?: string }) {
  const store = storeFor(storageKey);
  const cart = useSyncExternalStore(subscribe, store.read, getServerSnapshot);

  const addItemFn = useCallback((product: Omit<CartItem, "qty">, qty: number) => {
    store.write(addItemPure(store.read(), product, qty));
  }, [store]);

  const removeItemFn = useCallback((id: string, campaignId?: string) => {
    store.write(removeItemPure(store.read(), id, campaignId));
  }, [store]);

  const updateQtyFn = useCallback((id: string, qty: number, campaignId?: string) => {
    store.write(updateQtyPure(store.read(), id, qty, campaignId));
  }, [store]);

  const setLineFn = useCallback((product: Omit<CartItem, "qty" | "campaignId" | "campaignSlug">, qty: number) => {
    store.write(setLinePure(store.read(), product, qty));
  }, [store]);

  const clearFn = useCallback(() => {
    store.write(EMPTY_CART);
  }, [store]);

  return (
    <CartContext.Provider
      value={{
        cart,
        addItem: addItemFn,
        removeItem: removeItemFn,
        updateQty: updateQtyFn,
        setLine: setLineFn,
        totalItems: totalItemsPure(cart),
        clear: clearFn,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
