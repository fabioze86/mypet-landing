"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useCart } from "@mypet/core/components/cart-provider";
import type { Palette } from "@mypet/core/theme";
import type { CatalogLineItem, CatalogLineItemsResult } from "@mypet/core/catalog-line-items";
import type { CategoryNode } from "@mypet/core/catalog-utils";
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

  const disabled = item.unitPrice == null;

  return (
    <div className="pr-row">
      <img src={item.img} alt={item.name} className="pr-img" />
      <div className="pr-info">
        <p className="pr-name" style={{ color: P.navy }}>
          {item.name}
          {item.variantLabel ? ` — ${item.variantLabel}` : ""}
        </p>
        <p className="pr-meta" style={{ color: P.gray400 }}>
          {item.brand ? `${item.brand} · ` : ""}SKU: {item.sku}
        </p>
      </div>
      <div className="pr-price" style={{ color: disabled ? P.gray600 : P.navy }}>
        {item.priceLabel ?? "Sob consulta"}
      </div>
      <div className="pr-actions">
        <div className="pr-stepper" style={{ borderColor: P.gray200, opacity: disabled ? 0.5 : 1 }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setQty((q) => Math.max(0, q - 1))}
            aria-label={`Diminuir quantidade de ${item.name}`}
            style={{ color: P.gray600 }}
          >
            −
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={qty}
            disabled={disabled}
            aria-label={`Quantidade de ${item.name}`}
            onChange={(e) => setQty(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            style={{ color: P.navy }}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => setQty((q) => q + 1)}
            aria-label={`Aumentar quantidade de ${item.name}`}
            style={{ color: P.gray600 }}
          >
            +
          </button>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAdd(qty)}
          aria-label={`Adicionar ${item.name} ao carrinho`}
          className="pr-add"
          style={{ background: added ? P.navy : P.pink, color: P.white }}
        >
          {added ? "✓ Adicionado" : "Adicionar"}
        </button>
      </div>
    </div>
  );
}

export function PedidoRapidoTable({
  initialResult,
  brands,
  categories,
  palette: P,
}: {
  initialResult: CatalogLineItemsResult;
  brands: string[];
  categories: CategoryNode[];
  palette: Palette;
}) {
  const { cart, addItem, updateQty, totalItems } = useCart();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [categoryId, setCategoryId] = useState("");
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
        const next = await searchLineItems({
          q: q || undefined,
          brand: brand || undefined,
          categoryId: categoryId || undefined,
          page,
        });
        setResult(next);
      });
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, brand, categoryId, page]);

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
    <div>
      <style>{tableStyles(P)}</style>
      <div className="pr-filters">
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Buscar por nome ou SKU..."
          aria-label="Buscar produtos por nome ou SKU"
          className="pr-field pr-search"
        />
        <select
          value={categoryId}
          onChange={(e) => {
            setPage(1);
            setCategoryId(e.target.value);
          }}
          aria-label="Filtrar por categoria"
          className="pr-field"
        >
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {"— ".repeat(Math.max(0, (c.level ?? 1) - 1))}
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={brand}
          onChange={(e) => {
            setPage(1);
            setBrand(e.target.value);
          }}
          aria-label="Filtrar por marca"
          className="pr-field"
        >
          <option value="">Todas as marcas</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      <div className="pr-list" style={{ opacity: pending ? 0.6 : 1 }}>
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
        <div className="pr-pager">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="pr-page-btn">
            ← Anterior
          </button>
          <span style={{ fontSize: 14, color: P.gray600, whiteSpace: "nowrap" }}>
            {page} de {result.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= result.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="pr-page-btn"
          >
            Próxima →
          </button>
        </div>
      )}

      {totalItems > 0 && (
        <div className="pr-cartbar" style={{ background: P.navyDark, color: P.white }}>
          <div className="pr-cartbar-inner">
            <span style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {totalItems} {totalItems === 1 ? "item" : "itens"} — {brl(cartTotal)}
            </span>
            <Link href="/cotacao" className="pr-cartbar-cta" style={{ background: P.pink, color: P.white }}>
              Ver meu pedido →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function tableStyles(P: Palette) {
  return `
    .pr-filters { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr); gap: 8px; margin-bottom: 16px; }
    .pr-field { width: 100%; min-width: 0; padding: 10px 14px; border-radius: 10px; border: 1.5px solid ${P.gray200}; font-size: 14px; font-family: inherit; color: ${P.navy}; background: ${P.white}; text-overflow: ellipsis; }
    .pr-field:focus { outline: none; border-color: ${P.pink}; box-shadow: 0 0 0 3px ${P.pinkLight}; }

    .pr-list { background: ${P.white}; border: 1px solid ${P.gray200}; border-radius: 16px; overflow: hidden; transition: opacity .15s; }
    .pr-row { display: grid; grid-template-columns: 44px minmax(0, 1fr) 110px auto; align-items: center; gap: 16px; padding: 12px 16px; border-bottom: 1px solid ${P.gray100}; }
    .pr-row:last-child { border-bottom: 0; }
    .pr-img { width: 44px; height: 44px; object-fit: contain; border-radius: 8px; }
    .pr-info { min-width: 0; }
    .pr-name { margin: 0; font-size: 13px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
    .pr-meta { margin: 2px 0 0; font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; }
    .pr-price { text-align: right; font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .pr-actions { display: flex; align-items: center; gap: 8px; }
    .pr-stepper { display: flex; align-items: center; border: 1.5px solid; border-radius: 8px; }
    .pr-stepper button { width: 30px; height: 32px; border: 0; background: transparent; font-size: 16px; cursor: pointer; }
    .pr-stepper button:disabled { cursor: not-allowed; }
    .pr-stepper input { width: 40px; padding: 6px 2px; border: 0; text-align: center; font-size: 14px; font-family: inherit; background: transparent; -moz-appearance: textfield; }
    .pr-stepper input::-webkit-outer-spin-button,
    .pr-stepper input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .pr-add { padding: 9px 16px; border: 0; border-radius: 999px; font-size: 13px; font-weight: 600; font-family: inherit; white-space: nowrap; cursor: pointer; min-width: 112px; transition: background .18s; }
    .pr-add:disabled { cursor: not-allowed; opacity: .5; }

    .pr-pager { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 20px; }
    .pr-page-btn { padding: 9px 16px; border-radius: 999px; border: 1.5px solid ${P.gray200}; background: ${P.white}; color: ${P.navy}; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; white-space: nowrap; }
    .pr-page-btn:hover:not(:disabled) { border-color: ${P.navy}; }
    .pr-page-btn:disabled { opacity: .4; cursor: default; }

    .pr-cartbar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; padding-bottom: env(safe-area-inset-bottom); box-shadow: 0 -8px 24px rgba(15,31,69,.18); }
    .pr-cartbar-inner { max-width: 1100px; margin: 0 auto; padding: 12px 24px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .pr-cartbar-cta { padding: 10px 18px; border-radius: 999px; font-weight: 600; font-size: 14px; text-decoration: none; white-space: nowrap; }

    @media (max-width: 640px) {
      .pr-filters { grid-template-columns: 1fr 1fr; }
      .pr-search { grid-column: 1 / -1; }
      /* 16px evita o zoom automático do iOS ao focar o campo */
      .pr-field { font-size: 16px; padding: 10px 12px; }

      .pr-row {
        grid-template-columns: 56px minmax(0, 1fr);
        grid-template-areas: "img info" "img price" "actions actions";
        gap: 4px 12px;
        padding: 14px;
      }
      .pr-img { grid-area: img; width: 56px; height: 56px; align-self: start; }
      .pr-info { grid-area: info; }
      .pr-name { font-size: 14px; }
      .pr-price { grid-area: price; text-align: left; font-size: 15px; }
      .pr-actions { grid-area: actions; margin-top: 10px; }
      .pr-stepper button { width: 40px; height: 40px; font-size: 18px; }
      .pr-stepper input { width: 44px; font-size: 16px; }
      .pr-add { flex: 1; padding: 11px 16px; font-size: 14px; }

      .pr-page-btn { padding: 9px 12px; }
      .pr-cartbar-inner { padding: 10px 16px; }
    }
  `;
}
