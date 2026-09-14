import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("landing de campanha nunca exibe preço quando a campanha não é encontrada", async () => {
  const src = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(src, /notFound\(\)|campaign === null/);
});

test("landing de campanha trata status expired sem permitir compra", async () => {
  const src = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(src, /expired/);
  assert.match(src, /oferta encerrada/i);
});

test("landing de campanha trata falha do Hub com estado de erro", async () => {
  const src = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(src, /catch/);
  assert.match(src, /OffersErrorState/);
});
