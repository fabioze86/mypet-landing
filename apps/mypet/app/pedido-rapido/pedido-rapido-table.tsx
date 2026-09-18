"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useCart } from "@mypet/core/components/cart-provider";
import type { Palette } from "@mypet/core/theme";
import type { CatalogLineItem, CatalogLineItemsResult } from "@mypet/core/catalog-line-items";
import { searchLineItems } from "./actions";

const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const DEBOUNCE_MS = 300;

function Row({
  item,
  initialQty,
  added,
  onAdd,
  palette: P,
}: {
  item: CatalogLineItem;
  initialQty: number;
  added: boolean;
  onAdd: (qty: number) => void;
  palette: Palette;
}) {
  const [qty, setQty] = useState(initialQty);

  useEffect(() => {
    setQty(initialQty);
  }, [initialQty]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: 12,
        borderBottom: `1px solid ${P.gray100}`,
      }}
    >
      <img
        src={item.img}
        alt={item.name}
        style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 8, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: P.navy }}>
          {item.name}
          {item.variantLabel ? ` — ${item.variantLabel}` : ""}
        </p>
        <p style={{ fontSize: 11, color: P.gray400 }}>
          {item.brand ? `${item.brand} · ` : ""}SKU: {item.sku}
        </p>
      </div>
      <div style={{ width: 100, textAlign: "right", fontSize: 13, fontWeight: 800, color: P.navy }}>
        {item.priceLabel ?? "Sob consulta"}
      </div>
      <input
        type="number"
        min={0}
        value={qty}
        disabled={item.unitPrice == null}
        aria-label={`Quantidade de ${item.name}`}
        onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
        style={{
          width: 64,
          padding: "6px 8px",
          border: `1.5px solid ${P.gray200}`,
          borderRadius: 8,
          fontSize: 14,
        }}
      />
      <button
        type="button"
        disabled={item.unitPrice == null}
        onClick={() => onAdd(qty)}
        aria-label={`Adicionar ${item.name} ao carrinho`}
        style={{
          width: 36,
          height: 36,
          border: "none",
          borderRadius: 8,
          background: added ? P.green : P.gray100,
          color: added ? P.white : P.navy,
          fontSize: 16,
          cursor: item.unitPrice == null ? "not-allowed" : "pointer",
        }}
      >
        {added ? "✓" : "🛒"}
      </button>
    </div>
  );
}

export function PedidoRapidoTable({
  initialResult,
  brands,
  palette: P,
}: {
  initialResult: CatalogLineItemsResult;
  brands: string[];
  palette: Palette;
}) {
  const { cart, addItem, updateQty, totalItems } = useCart();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(initialResult);
  const [pending, startTransition] = useTransition();
  const [justAdded, setJustAdded] = useState<Record<string, boolean>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const next = await searchLineItems({ q: q || undefined, brand: brand || undefined, page });
        setResult(next);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, brand, page]);

  const qtyInCart: Record<string, number> = {};
  for (const item of cart.items) qtyInCart[item.id] = item.qty;

  const cartTotal = cart.items.reduce(
    (sum, item) => sum + (item.unitPrice != null ? item.unitPrice * item.qty : 0),
    0,
  );

  function handleAdd(item: CatalogLineItem, qty: number) {
    if (item.unitPrice == null) return;
    if (item.id in qtyInCart) {
      updateQty(item.id, qty);
    } else {
      if (qty <= 0) return;
      addItem(
        { id: item.id, name: item.name, sku: item.sku, brand: item.brand, img: item.img, unitPrice: item.unitPrice },
        qty,
      );
    }
    setJustAdded((cur) => ({ ...cur, [item.id]: true }));
    setTimeout(() => setJustAdded((cur) => ({ ...cur, [item.id]: false })), 1500);
  }

  return (
    <div style={{ paddingBottom: 96 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Buscar por nome ou SKU..."
          aria-label="Buscar produtos por nome ou SKU"
          style={{ flex: "1 1 240px", padding: "10px 14px", borderRadius: 10, border: `1px solid ${P.gray200}`, fontSize: 14 }}
        />
        <select
          value={brand}
          onChange={(e) => {
            setPage(1);
            setBrand(e.target.value);
          }}
          aria-label="Filtrar por marca"
          style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${P.gray200}`, fontSize: 14, background: P.white }}
        >
          <option value="">Todas as marcas</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      <div
        style={{
          background: P.white,
          border: `1px solid ${P.gray200}`,
          borderRadius: 16,
          overflow: "hidden",
          opacity: pending ? 0.6 : 1,
        }}
      >
        {result.items.length === 0 ? (
          <p style={{ padding: 32, textAlign: "center", fontSize: 14, color: P.gray600 }}>
            Nenhum produto encontrado.
          </p>
        ) : (
          result.items.map((item) => (
            <Row
              key={item.id}
              item={item}
              initialQty={qtyInCart[item.id] ?? 1}
              added={Boolean(justAdded[item.id])}
              onAdd={(qty) => handleAdd(item, qty)}
              palette={P}
            />
          ))
        )}
      </div>

      {result.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 24 }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="cat-btn">
            ← Anterior
          </button>
          <span style={{ fontSize: 14, color: P.gray600 }}>
            Página {page} de {result.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= result.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="cat-btn"
          >
            Próxima →
          </button>
        </div>
      )}

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: P.navy,
          color: P.white,
          padding: "14px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 50,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700 }}>
          {totalItems} {totalItems === 1 ? "item" : "itens"} — {brl(cartTotal)}
        </span>
        <Link href="/cotacao" style={{ color: P.white, fontWeight: 800, textDecoration: "none", fontSize: 14 }}>
          Ver meu pedido →
        </Link>
      </div>
    </div>
  );
}
