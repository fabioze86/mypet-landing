// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CartProvider, useCart } from "./cart-provider";

const wrapper = ({ children }: { children: ReactNode }) => createElement(CartProvider, null, children);
const base = { id: "p1", name: "Ração", sku: "R1", brand: null, img: "/r.jpg" };

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe("CartProvider.setLine", () => {
  it("define a linha sem campanha com dados novos e quantidade final, sem tocar a de campanha", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => {
      result.current.addItem({ ...base, campaignId: "camp", unitPrice: 5 }, 1);
      result.current.addItem({ ...base, unitPrice: 10 }, 2);
    });
    act(() => result.current.setLine({ ...base, name: "Ração 15kg", unitPrice: 12 }, 6));
    expect(result.current.cart.items).toEqual([
      { ...base, campaignId: "camp", unitPrice: 5, qty: 1 },
      { ...base, name: "Ração 15kg", unitPrice: 12, qty: 6 },
    ]);
    act(() => result.current.setLine(base, 0));
    expect(result.current.cart.items).toEqual([{ ...base, campaignId: "camp", unitPrice: 5, qty: 1 }]);
  });
});
