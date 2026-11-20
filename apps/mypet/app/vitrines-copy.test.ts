import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regra do mypet: nada de "loja", "atacado" ou "cotação" em texto visível.
// Confere os literais de texto (entre aspas, crases ou em JSX) dos arquivos novos.
const ARQUIVOS = [
  "_components/vitrine/vitrine-page.tsx",
  "_components/vitrine/vitrine-cart-bar.tsx",
  "_components/frete/frete-faixa.tsx",
  "_components/frete/frete-resumo.tsx",
  "cotacao/cotacao-content.tsx",
  "cotacao/page.tsx",
  "cotacao/whatsapp-order.ts",
  "produtos/page.tsx",
  "fabrica/page.tsx",
  "fabrica/cotacao/page.tsx",
  "_components/hub/doors.ts",
  "../lib/vitrines.ts",
  "../lib/frete.config.ts",
  "../../../packages/core/src/frete.ts",
];
const PROIBIDAS = /\b(loja|atacado|cota[cç][aã]o)\b/i;

function textosVisiveis(src: string): string[] {
  const semImports = src.replace(/^import .*$/gm, "").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const literais = [...semImports.matchAll(/(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g)].map((m) => m[2]);
  const jsx = [...semImports.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]);
  return [...literais, ...jsx].filter((t) => !t.startsWith("/") && !t.startsWith("@") && !t.startsWith(".") && !/^\$\{[^}]*\}\/\S*$/.test(t));
}

describe("copy das vitrines", () => {
  for (const arquivo of ARQUIVOS) {
    it(`${arquivo} não usa palavras proibidas`, () => {
      const src = readFileSync(join(__dirname, arquivo), "utf8");
      expect(textosVisiveis(src).filter((t) => PROIBIDAS.test(t))).toEqual([]);
    });
  }
});
