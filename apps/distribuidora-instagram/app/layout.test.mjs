import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("layout raiz monta o cabeçalho com link visível para o carrinho", async () => {
  const src = await readFile(new URL("./layout.tsx", import.meta.url), "utf8");
  assert.match(src, /HotsiteHeader/);
});

test("cabeçalho do hotsite linka para /carrinho com contador de itens", async () => {
  const src = await readFile(new URL("./hotsite-header.tsx", import.meta.url), "utf8");
  assert.match(src, /\/carrinho/);
  assert.match(src, /useCart/);
  assert.match(src, /totalItems/);
});
