import { describe, it, expect, vi } from "vitest";
import type { AgentConfig } from "@mypet/core/agent-server";

// vi.hoisted: o mock roda no import de "./route", antes das declarações do arquivo.
const { captured, requireBuyer } = vi.hoisted(() => ({
  captured: {} as { config?: AgentConfig },
  requireBuyer: vi.fn(),
}));

vi.mock("@mypet/core/agent-server", () => ({
  createAgentHandler: (config: AgentConfig) => {
    captured.config = config;
    return async () => new Response(null);
  },
}));
vi.mock("@/lib/require-buyer", () => ({ requireBuyer: () => requireBuyer() }));

import { maxDuration } from "./route";

describe("/api/agente", () => {
  it("usa o canal, o nome e o FAQ do site", () => {
    expect(captured.config?.channel).toBe("mypetbrasil");
    expect(captured.config?.siteName).toBe("My Pet Brasil");
    expect(captured.config?.faq.length).toBeGreaterThan(0);
  });

  it("identifica o comprador pelo cookie (requireBuyer)", async () => {
    const resolveBuyer = captured.config!.resolveBuyer;

    requireBuyer.mockResolvedValueOnce({
      id: "b1",
      empresa: "Pet Shop X",
      email: null,
      nome: null,
      whatsapp: "5511999990000",
      cnpj: "00000000000100",
    });
    expect(await resolveBuyer({} as never)).toEqual({ id: "b1", empresa: "Pet Shop X" });

    requireBuyer.mockResolvedValueOnce(null);
    expect(await resolveBuyer({} as never)).toBeNull();
  });
});

describe("/api/agente: duração máxima", () => {
  it("permite até 60s (timeout total do modelo é 45s)", () => {
    expect(maxDuration).toBe(60);
  });
});
