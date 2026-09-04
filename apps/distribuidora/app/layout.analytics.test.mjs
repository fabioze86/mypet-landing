import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../..", import.meta.url);

test("the root layout includes Vercel Analytics", async () => {
  const [packageJson, layout] = await Promise.all([
    readFile(new URL("apps/distribuidora/package.json", root), "utf8"),
    readFile(new URL("apps/distribuidora/app/layout.tsx", root), "utf8"),
  ]);

  assert.equal(JSON.parse(packageJson).dependencies["@vercel/analytics"] !== undefined, true);
  assert.match(layout, /import\s+\{\s*Analytics\s*\}\s+from\s+["']@vercel\/analytics\/next["']/);
  assert.match(layout, /<Analytics\s*\/>/);
});
