import { describe, it, expect, vi, afterEach } from "vitest";
import { subscribeToPush } from "./push";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("subscribeToPush", () => {
  it("não faz nada quando o navegador não suporta push", async () => {
    vi.stubGlobal("navigator", {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await subscribeToPush("distribuidora", "chave-publica");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("não inscreve quando a permissão é negada", async () => {
    vi.stubGlobal("navigator", { serviceWorker: {} });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", { requestPermission: vi.fn().mockResolvedValue("denied") });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await subscribeToPush("distribuidora", "chave-publica");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("inscreve e envia a subscription para a API quando a permissão é concedida", async () => {
    const subscribeMock = vi.fn().mockResolvedValue({ endpoint: "https://push.example/abc" });
    vi.stubGlobal("navigator", {
      serviceWorker: {
        ready: Promise.resolve({ pushManager: { subscribe: subscribeMock } }),
      },
    });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", { requestPermission: vi.fn().mockResolvedValue("granted") });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await subscribeToPush("distribuidora", "chave-publica");

    expect(subscribeMock).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: "chave-publica",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/push/subscribe",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("nunca lança exceção quando o subscribe falha", async () => {
    vi.stubGlobal("navigator", {
      serviceWorker: { ready: Promise.reject(new Error("sw indisponível")) },
    });
    vi.stubGlobal("PushManager", class {});
    vi.stubGlobal("Notification", { requestPermission: vi.fn().mockResolvedValue("granted") });
    vi.stubGlobal("fetch", vi.fn());

    await expect(subscribeToPush("distribuidora", "chave-publica")).resolves.toBeUndefined();
  });
});
