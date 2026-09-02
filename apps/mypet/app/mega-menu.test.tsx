import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MegaMenu } from "@mypet/core/components/mega-menu";
import { ClientConfigProvider } from "@mypet/core/theme";
import { clientConfig } from "@/client.config";

describe("MegaMenu", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("mantém o painel de subcategorias visível depois de aberto", () => {
    render(
      <ClientConfigProvider config={clientConfig}>
        <MegaMenu
          tree={[
            {
              id: "dogs",
              slug: "caes",
              name: "Cães",
              parentId: null,
              level: 1,
              sortOrder: 0,
              children: [
                {
                  id: "food",
                  slug: "racao",
                  name: "Ração",
                  parentId: "dogs",
                  level: 2,
                  sortOrder: 0,
                  children: [],
                },
              ],
            },
          ]}
        />
      </ClientConfigProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cães" }));

    const viewport = document.querySelector(".mega-menu-viewport");
    const content = document.querySelector(".mega-menu-content");
    expect(viewport).toHaveAttribute("data-state", "open");
    expect(content).not.toBeNull();

    const ruleThatKeepsOpenContentVisible = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .find(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule &&
          rule.style.getPropertyValue("animation").includes("megaMenuFadeIn") &&
          content!.matches(rule.selectorText),
      );

    expect(ruleThatKeepsOpenContentVisible).toBeDefined();
  });
});
