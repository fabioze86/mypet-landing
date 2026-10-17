import { describe, expect, it } from "vitest";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  faqJsonLd,
  jsonLdScript,
  organizationJsonLd,
  personJsonLd,
  serviceJsonLd,
  websiteJsonLd,
} from "./jsonld";

describe("jsonLdScript", () => {
  it("escapa < para não fechar a tag script", () => {
    expect(jsonLdScript({ a: "</script>" })).toBe('{"a":"\u003c/script>"}');
  });
});

describe("builders", () => {
  it("organization traz CNPJ, e-mail e omite sameAs sem LinkedIn", () => {
    const org = organizationJsonLd();
    expect(org).toMatchObject({
      "@type": "Organization",
      name: "Zemann",
      legalName: "DPZ COMMERCE",
      taxID: "67.145.989/0001-00",
      email: "contato@zemann.com.br",
      url: "https://www.zemann.com.br",
    });
    expect(org).not.toHaveProperty("sameAs");
  });

  it("website aponta para a organização", () => {
    expect(websiteJsonLd()).toMatchObject({
      "@type": "WebSite",
      url: "https://www.zemann.com.br",
      publisher: { "@id": "https://www.zemann.com.br/#org" },
    });
  });

  it("person trabalha na organização", () => {
    expect(personJsonLd()).toMatchObject({
      "@type": "Person",
      name: "Fábio Zemann",
      worksFor: { "@id": "https://www.zemann.com.br/#org" },
    });
  });

  it("service com preço inclui Offer com preço mínimo em BRL", () => {
    const service = serviceJsonLd({ name: "Diagnóstico", description: "D", path: "/d", priceFrom: 1500 });
    expect(service).toMatchObject({
      "@type": "Service",
      url: "https://www.zemann.com.br/d",
      areaServed: "BR",
      offers: {
        "@type": "Offer",
        priceSpecification: { "@type": "PriceSpecification", minPrice: 1500, priceCurrency: "BRL" },
      },
    });
  });

  it("service sem preço não tem offers", () => {
    expect(serviceJsonLd({ name: "S", description: "D", path: "/s", priceFrom: null })).not.toHaveProperty("offers");
  });

  it("article traz autor e datas", () => {
    expect(
      articleJsonLd({ title: "T", description: "D", path: "/guias/t", publishedAt: "2026-10-01", updatedAt: "2026-10-02" }),
    ).toMatchObject({
      "@type": "Article",
      headline: "T",
      datePublished: "2026-10-01",
      dateModified: "2026-10-02",
      author: { "@type": "Person", name: "Fábio Zemann", url: "https://www.zemann.com.br/sobre" },
      mainEntityOfPage: "https://www.zemann.com.br/guias/t",
    });
  });

  it("faq vira FAQPage com Question/Answer", () => {
    expect(faqJsonLd([{ q: "P?", a: "R." }])).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [{ "@type": "Question", name: "P?", acceptedAnswer: { "@type": "Answer", text: "R." } }],
    });
  });

  it("breadcrumb numera os itens com URL absoluta", () => {
    expect(breadcrumbJsonLd([{ name: "Início", path: "/" }, { name: "Guias", path: "/guias" }])).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: "https://www.zemann.com.br/" },
        { "@type": "ListItem", position: 2, name: "Guias", item: "https://www.zemann.com.br/guias" },
      ],
    });
  });
});
