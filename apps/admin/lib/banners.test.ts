import { describe, it, expect } from "vitest";
import { findConflictingCategoryBanner } from "./banners";

const base = { id: "existing", type: "categoria" as const, channel: "mypetbrasil", category_id: "cat-1", active: true };

describe("findConflictingCategoryBanner", () => {
  it("retorna null quando o tipo não é categoria", () => {
    expect(findConflictingCategoryBanner([base], { type: "principal", channel: "mypetbrasil", category_id: null })).toBeNull();
  });

  it("encontra conflito com banner ativo na mesma categoria e canal", () => {
    const result = findConflictingCategoryBanner([base], { type: "categoria", channel: "mypetbrasil", category_id: "cat-1" });
    expect(result).toEqual({ id: "existing" });
  });

  it("ignora banners inativos", () => {
    const result = findConflictingCategoryBanner(
      [{ ...base, active: false }],
      { type: "categoria", channel: "mypetbrasil", category_id: "cat-1" },
    );
    expect(result).toBeNull();
  });

  it("ignora o próprio registro ao editar (mesmo id)", () => {
    const result = findConflictingCategoryBanner(
      [base],
      { id: "existing", type: "categoria", channel: "mypetbrasil", category_id: "cat-1" },
    );
    expect(result).toBeNull();
  });

  it("ignora categorias/canais diferentes", () => {
    const result = findConflictingCategoryBanner(
      [base],
      { type: "categoria", channel: "distribuidora", category_id: "cat-1" },
    );
    expect(result).toBeNull();
  });
});
