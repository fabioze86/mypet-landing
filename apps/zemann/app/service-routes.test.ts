// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SERVICES } from "@/lib/services";

const appDir = fileURLToPath(new URL(".", import.meta.url));

describe("rotas dos serviços", () => {
  for (const service of Object.values(SERVICES)) {
    it(`${service.path} tem page.tsx e opengraph-image.tsx do serviço certo`, () => {
      const dir = join(appDir, service.path.slice(1));
      const key = `SERVICES[${JSON.stringify(service.key)}]`;
      for (const file of ["page.tsx", "opengraph-image.tsx"]) {
        const path = join(dir, file);
        expect(existsSync(path), path).toBe(true);
        expect(readFileSync(path, "utf8"), path).toContain(key);
      }
    });
  }
});
