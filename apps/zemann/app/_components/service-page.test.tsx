import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SERVICES, serviceSummary } from "@/lib/services";
import { ServicePage } from "./service-page";

describe("ServicePage", () => {
  it("mostra H1, abertura e dois CTAs que levam ao contato com o serviço escolhido", () => {
    render(<ServicePage service={SERVICES.seo} />);
    expect(screen.getByRole("heading", { level: 1, name: SERVICES.seo.title })).toBeInTheDocument();
    expect(screen.getByText(SERVICES.seo.intro)).toBeInTheDocument();
    const ctas = screen.getAllByRole("link", { name: "Fale com um especialista" });
    expect(ctas).toHaveLength(2);
    for (const link of ctas) expect(link).toHaveAttribute("href", "/contato?servico=seo");
    expect(ctas.map((link) => link.getAttribute("data-cta"))).toEqual(["servico_seo_topo", "servico_seo_final"]);
  });

  it("segue a ordem de seções do modelo", () => {
    render(<ServicePage service={SERVICES.cro} />);
    const titles = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual([
      "Para quem é",
      "O que inclui",
      "Como funciona",
      "Como se conecta aos outros serviços",
      "Perguntas frequentes",
      "Vamos conversar sobre a sua loja?",
    ]);
  });

  it("conexões apontam para as páginas dos serviços ligados", () => {
    const service = SERVICES["trafego-pago"];
    render(<ServicePage service={service} />);
    const section = screen.getByRole("heading", { level: 2, name: "Como se conecta aos outros serviços" }).closest("section")!;
    const hrefs = within(section).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(service.connections.map((c) => serviceSummary(c.key).path));
  });

  it("rótulo de analytics vira snake_case em chave com hífen", () => {
    render(<ServicePage service={SERVICES["trafego-pago"]} />);
    const [top] = screen.getAllByRole("link", { name: "Fale com um especialista" });
    expect(top).toHaveAttribute("data-cta", "servico_trafego_pago_topo");
  });

  it("publica JSON-LD de Service, FAQPage e BreadcrumbList", () => {
    const { container } = render(<ServicePage service={SERVICES.ux} />);
    const data = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent!));
    expect(data.map((d) => d["@type"])).toEqual(expect.arrayContaining(["Service", "FAQPage", "BreadcrumbList"]));
    expect(data.find((d) => d["@type"] === "Service")).toMatchObject({
      serviceType: "UX",
      url: "https://www.zemann.com.br/ux-para-ecommerce",
    });
  });
});
