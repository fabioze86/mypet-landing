"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useClientConfig } from "../theme";
import type { ProductVariant } from "../catalog-utils";

export function variantLabel(variant: ProductVariant): string {
  if (variant.axis.length === 0) return variant.name;
  return variant.axis.map((a) => a.valor).join(" / ");
}

export function useSelectedVariant(variants: ProductVariant[]): {
  selected: ProductVariant;
  select: (id: string) => void;
} {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fromQuery = searchParams.get("variante");
  const activeId = pendingId ?? fromQuery;
  const selected = useMemo(
    () => variants.find((v) => v.id === activeId) ?? variants[0],
    [variants, activeId],
  );

  const select = (id: string) => {
    setPendingId(id);
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("variante", id);
    router.replace(`?${sp.toString()}`, { scroll: false });
  };

  return { selected, select };
}

export function VariantSelector({
  variants,
  selectedId,
  onSelect,
}: {
  variants: ProductVariant[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { palette } = useClientConfig();

  if (variants.length < 2) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12, color: palette.gray600, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Escolha uma opção
      </span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {variants.map((variant) => {
          const active = variant.id === selectedId;
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(variant.id)}
              style={{
                padding: "8px 16px",
                borderRadius: 100,
                border: `1.5px solid ${active ? palette.pink : palette.gray200}`,
                background: active ? palette.pink : palette.white,
                color: active ? palette.white : palette.gray800,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {variantLabel(variant)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
