import { describe, expect, it } from "vitest";
import { PAGES } from "./pages";
import {
  AMAZON_SERVICE,
  SERVICES,
  SERVICE_LIST,
  contactHref,
  isServiceKey,
  parseServiceParam,
  serviceSummary,
} from "./services";

const services = Object.values(SERVICES);
// Selos que a Zemann não tem, vínculo com plataformas e promessa de resultado.
const BANNED = ["parceiro oficial", "parceira oficial", "partner", "certificad", "garant"];

describe("SERVICES", () => {
  it("tem os 7 serviços da agência, cada um com a chave igual à do registro", () => {
    expect(Object.keys(SERVICES)).toEqual([
      "seo",
      "trafego-pago",
      "cro",
      "email-marketing",
      "ux",
      "social-media",
      "assessoria",
    ]);
    for (const [key, service] of Object.entries(SERVICES)) expect(service.key).toBe(key);
  });

  it("tem caminhos únicos na raiz, sem colisão com as páginas fixas", () => {
    const paths = services.map((service) => service.path);
    const pagePaths = Object.values(PAGES).map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of paths) {
      expect(path).toMatch(/^\/[a-z-]+$/);
      expect(pagePaths).not.toContain(path);
    }
  });

  it("respeita os limites de título e descrição", () => {
    for (const service of services) {
      expect(service.title.length, service.key).toBeLessThanOrEqual(55);
      expect(service.description.length, service.key).toBeLessThanOrEqual(160);
    }
  });

  it("título e descrição não citam a Amazon", () => {
    for (const service of services) {
      expect(`${service.title} ${service.description}`.toLowerCase(), service.key).not.toContain("amazon");
    }
  });

  it("copy sem selos, promessas de resultado nem números", () => {
    for (const service of services) {
      const text = JSON.stringify({ ...service, path: "" }).toLowerCase();
      for (const word of BANNED) expect(text, `${service.key}: ${word}`).not.toContain(word);
      expect(/\d/.test(text), `${service.key} tem número na copy`).toBe(false);
    }
  });

  it("segue as quantidades do modelo de página", () => {
    for (const service of services) {
      expect(service.audiences.length, service.key).toBeGreaterThanOrEqual(2);
      expect(service.audiences.length, service.key).toBeLessThanOrEqual(4);
      expect(service.includes.length, service.key).toBeGreaterThanOrEqual(4);
      expect(service.includes.length, service.key).toBeLessThanOrEqual(6);
      expect(service.steps.length, service.key).toBeGreaterThanOrEqual(3);
      expect(service.steps.length, service.key).toBeLessThanOrEqual(4);
      expect(service.connections.length, service.key).toBeGreaterThanOrEqual(2);
      expect(service.connections.length, service.key).toBeLessThanOrEqual(3);
      expect(service.faq.length, service.key).toBeGreaterThanOrEqual(3);
      expect(service.faq.length, service.key).toBeLessThanOrEqual(5);
    }
  });

  it("toda conexão aponta para outro serviço existente", () => {
    for (const service of services) {
      for (const connection of service.connections) {
        expect(isServiceKey(connection.key), `${service.key} → ${connection.key}`).toBe(true);
        expect(connection.key).not.toBe(service.key);
      }
    }
  });

  it("perguntas terminam em interrogação", () => {
    for (const service of services) {
      for (const item of service.faq) expect(item.q.endsWith("?"), item.q).toBe(true);
    }
  });
});

describe("SERVICE_LIST", () => {
  it("tem os 8 serviços, com a Amazon em primeiro apontando para a página de marcas", () => {
    expect(SERVICE_LIST).toHaveLength(8);
    expect(SERVICE_LIST[0]).toBe(AMAZON_SERVICE);
    expect(AMAZON_SERVICE.path).toBe(PAGES.marcas.path);
    expect(new Set(SERVICE_LIST.map((service) => service.key)).size).toBe(8);
  });
});

describe("helpers", () => {
  it("isServiceKey só aceita chaves do catálogo", () => {
    expect(isServiceKey("seo")).toBe(true);
    expect(isServiceKey("amazon")).toBe(true);
    expect(isServiceKey("influencers")).toBe(false);
    expect(isServiceKey("")).toBe(false);
  });

  it("parseServiceParam ignora valor desconhecido, vazio ou repetido", () => {
    expect(parseServiceParam("cro")).toBe("cro");
    expect(parseServiceParam("nada")).toBeUndefined();
    expect(parseServiceParam(["seo", "cro"])).toBeUndefined();
    expect(parseServiceParam(undefined)).toBeUndefined();
  });

  it("serviceSummary e contactHref", () => {
    expect(serviceSummary("amazon").name).toBe("Amazon");
    expect(serviceSummary("trafego-pago").path).toBe("/trafego-pago-para-ecommerce");
    expect(contactHref("trafego-pago")).toBe("/contato?servico=trafego-pago");
  });
});
