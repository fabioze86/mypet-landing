"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useClientConfig } from "../theme";
import { buildCatalogQuery } from "../querystring";

// Busca ao digitar: atualiza ?q= após uma pausa (a grade é renderizada no
// servidor a partir dos searchParams). A query inicial vem por prop para não
// depender de useSearchParams (que exigiria Suspense na rota pré-renderizada).
export function CatalogSearchBox({
  initialQuery = "",
  brand,
  debounceMs = 300,
}: {
  initialQuery?: string;
  brand?: string;
  debounceMs?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { palette } = useClientConfig();
  const [value, setValue] = useState(initialQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastPushed = useRef(initialQuery.trim());

  const historyNav = useRef(false);

  // Só o histórico do navegador (voltar/avançar) sobrescreve o campo; um eco
  // atrasado do servidor de uma busca anterior não pode atropelar a digitação.
  useEffect(() => {
    const onPop = () => { historyNav.current = true; };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (!historyNav.current) return;
    historyNav.current = false;
    setValue(initialQuery);
    lastPushed.current = initialQuery.trim();
  }, [initialQuery]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const handleChange = (next: string) => {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const trimmed = next.trim();
      if (trimmed === lastPushed.current) return;
      lastPushed.current = trimmed;
      const query = buildCatalogQuery({ q: trimmed || undefined, brand });
      router.replace(`${pathname}${query}`, { scroll: false });
    }, debounceMs);
  };

  return (
    <div className="catalog-search" style={{ position: "sticky", top: 64, zIndex: 90, background: palette.gray50, padding: "10px 16px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <input
          type="search"
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="Buscar produtos…"
          aria-label="Buscar produtos"
          enterKeyHint="search"
          autoComplete="off"
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: `1.5px solid ${palette.gray200}`,
            background: palette.white,
            fontSize: 16,
            color: palette.gray800,
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}
