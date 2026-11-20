"use client";

import { createContext, useContext } from "react";

// Prefixo das rotas da vitrine atual ("" no site normal, "/fabrica" na Linha de Fábrica).
// Os links de produto, de categoria e do carrinho montam o caminho com ele.
const VitrinePathContext = createContext("");

export function VitrinePathProvider({ basePath, children }: { basePath: string; children: React.ReactNode }) {
  return <VitrinePathContext.Provider value={basePath}>{children}</VitrinePathContext.Provider>;
}

export function useVitrinePath(): string {
  return useContext(VitrinePathContext);
}
