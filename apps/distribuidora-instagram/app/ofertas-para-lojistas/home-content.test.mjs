import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("home de ofertas trata falha do Hub com estado de erro, sem preço em cache exibido como atual", async () => {
  const src = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(src, /catch/);
  assert.match(src, /OffersErrorState/);
});

test("home de ofertas separa a seção de ofertas relâmpago das demais", async () => {
  const src = await readFile(new URL("./page.tsx", import.meta.url), "utf8");
  assert.match(src, /flashOffer/);
  assert.match(src, /CampaignCountdown/);
});
