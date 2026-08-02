import { describe, it, expect } from "vitest";
import {
  productJsonLd,
  breadcrumbJsonLd,
  canonicalUrl,
  organizationJsonLd,
  jsonLdScript,
  type PdpProductForSeo,
} from "./seo";
import type { ClientConfig } from "./theme";

describe("canonicalUrl", () => {
  it("monta a URL absoluta a partir de domain e path", () => {
    expect(canonicalUrl("mypetbrasil.com.br", "/produtos/p1")).toBe(
      "https://mypetbrasil.com.br/produtos/p1",
    );
  });
});

describe("productJsonLd", () => {
  const base: PdpProductForSeo = {
    id: "p1",
    name: "Ração X",
    brand: "NAPI",
    description: "Ração premium",
    img: "https://img/p1.jpg",
    productRole: "simple",
    variants: [],
  };

  it("retorna null quando o produto é parent (usa productGroupJsonLd)", () => {
    expect(productJsonLd({ ...base, productRole: "parent" }, "dominio.com")).toBeNull();
  });

  it("monta Product com todos os campos quando presentes", () => {
    expect(productJsonLd(base, "dominio.com")).toEqual({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Ração X",
      sku: "p1",
      brand: { "@type": "Brand", name: "NAPI" },
      description: "Ração premium",
      image: "https://img/p1.jpg",
      url: "https://dominio.com/produtos/p1",
    });
  });

  it("omite brand e description quando ausentes", () => {
    const product: PdpProductForSeo = { ...base, brand: null, description: null };
    const result = productJsonLd(product, "dominio.com") as Record<string, unknown>;
    expect(result.brand).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.image).toBe("https://img/p1.jpg");
  });
});

describe("breadcrumbJsonLd", () => {
  it("monta itemListElement com posição 1-indexada", () => {
    const items = [
      { name: "Início", path: "/" },
      { name: "Ração", path: "/categoria/racao" },
      { name: "Ração X", path: "/produtos/p1" },
    ];
    expect(breadcrumbJsonLd(items, "dominio.com")).toEqual({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: "https://dominio.com/" },
        { "@type": "ListItem", position: 2, name: "Ração", item: "https://dominio.com/categoria/racao" },
        { "@type": "ListItem", position: 3, name: "Ração X", item: "https://dominio.com/produtos/p1" },
      ],
    });
  });
});

describe("jsonLdScript", () => {
  it("neutraliza uma sequência </script> sem alterar o conteúdo semântico", () => {
    const payload = { name: "</script><script>alert(1)</script>" };
    const html = jsonLdScript(payload);
    expect(html).not.toContain("</script>");
    expect(JSON.parse(html)).toEqual(payload);
  });
});

describe("organizationJsonLd", () => {
  it("monta Organization com nome, url e logo (imagem OG gerada)", () => {
    const config = { name: "My Pet Brasil", domain: "mypetbrasil.com.br" } as ClientConfig;
    expect(organizationJsonLd(config)).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "My Pet Brasil",
      url: "https://mypetbrasil.com.br",
      logo: "https://mypetbrasil.com.br/opengraph-image",
    });
  });
});
