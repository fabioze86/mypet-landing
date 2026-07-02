"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import {
  addItem as addItemPure,
  removeItem as removeItemPure,
  totalItems as totalItemsPure,
  updateQty as updateQtyPure,
  type Cart,
  type CartItem,
} from "@/lib/cart";

const STORAGE_KEY = "mypet_cart";
const CART_EVENT = "mypet_cart_updated";
const EMPTY_CART: Cart = { items: [] };

let cachedRaw: string | null = null;
let cachedSnapshot: Cart = EMPTY_CART;

function readCart(): Cart {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
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
}

function writeCart(cart: Cart) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event(CART_EVENT));
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
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  totalItems: number;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de CartProvider");
  return ctx;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const cart = useSyncExternalStore(subscribe, readCart, getServerSnapshot);

  const addItemFn = useCallback((product: Omit<CartItem, "qty">, qty: number) => {
    writeCart(addItemPure(readCart(), product, qty));
  }, []);

  const removeItemFn = useCallback((id: string) => {
    writeCart(removeItemPure(readCart(), id));
  }, []);

  const updateQtyFn = useCallback((id: string, qty: number) => {
    writeCart(updateQtyPure(readCart(), id, qty));
  }, []);

  const clearFn = useCallback(() => {
    writeCart(EMPTY_CART);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        addItem: addItemFn,
        removeItem: removeItemFn,
        updateQty: updateQtyFn,
        totalItems: totalItemsPure(cart),
        clear: clearFn,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
