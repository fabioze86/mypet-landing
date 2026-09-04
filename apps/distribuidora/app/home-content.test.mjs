import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

test("home da distribuidora remove atalhos e mostra os novos diferenciais", async () => {
  const source = await readFile(new URL("apps/distribuidora/app/page.tsx", root), "utf8");

  assert.doesNotMatch(source, /QuickNavIcons/);
  assert.match(source, /99,90/);
  assert.match(source, /Entrega grátis SP/);
  assert.match(source, /18 anos/);
  assert.match(source, /No Mercado Pet/);
  assert.match(source, /3x/);
  assert.match(source, /Sem Juros no Cartão/);
  assert.match(source, /fabricação própria/i);
  assert.match(source, /kits.*revenda/i);
});

test("home da distribuidora não expõe temporariamente o assistente de IA", async () => {
  const source = await readFile(new URL("apps/distribuidora/app/page.tsx", root), "utf8");

  assert.doesNotMatch(source, /<AssistantSearch\b/);
});

test("a configuração de ambiente documenta o destino da cotação", async () => {
  const envExample = await readFile(new URL("apps/distribuidora/.env.example", root), "utf8");
  const quoteContent = await readFile(new URL("apps/distribuidora/app/cotacao/cotacao-content.tsx", root), "utf8");

  assert.match(envExample, /^NEXT_PUBLIC_WHATSAPP_NUMBER=5511981030532$/m);
  assert.match(quoteContent, /NEXT_PUBLIC_WHATSAPP_NUMBER \|\| "5511981030532"/);
});
