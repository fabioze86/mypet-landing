import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("./cotacao-content.tsx", import.meta.url);

test("abre a aba do WhatsApp durante o clique, antes de finalizar a cotação", async () => {
  const source = await readFile(sourceUrl, "utf8");
  const popupOpenIndex = source.indexOf('window.open("", "_blank")');
  const finalizeQuoteIndex = source.indexOf("await finalizeQuote(cart.items)");

  assert.notEqual(popupOpenIndex, -1, "a aba do WhatsApp deve ser aberta no clique");
  assert.ok(popupOpenIndex < finalizeQuoteIndex, "a aba deve abrir antes da Server Action");
});
