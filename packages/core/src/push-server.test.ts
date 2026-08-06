import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { NextRequest } from "next/server";

const upsertMock = vi.fn();
const selectEqMock = vi.fn();
const deleteEqMock = vi.fn();
const fromCalls: string[] = [];

vi.mock("./supabase", () => ({
  getHubClient: () => ({
    from: (table: string) => {
      fromCalls.push(table);
      return { upsert: upsertMock };
    },
  }),
  getHubServiceClient: () => ({
    from: (table: string) => {
      fromCalls.push(table);
      return {
        select: () => ({ eq: selectEqMock }),
        delete: () => ({ eq: deleteEqMock }),
      };
    },
  }),
}));

const { sendNotificationMock, setVapidDetailsMock } = vi.hoisted(() => ({
  sendNotificationMock: vi.fn(),
  setVapidDetailsMock: vi.fn(),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: setVapidDetailsMock,
    sendNotification: sendNotificationMock,
  },
}));

import { createPushSubscribePostHandler, sendPushBroadcast } from "./push-server";

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  upsertMock.mockReset();
  selectEqMock.mockReset();
  deleteEqMock.mockReset();
  sendNotificationMock.mockReset();
  setVapidDetailsMock.mockReset();
  fromCalls.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createPushSubscribePostHandler", () => {
  it("grava a subscription na tabela push_subscriptions com upsert por endpoint", async () => {
    upsertMock.mockResolvedValue({ error: null });
    const POST = createPushSubscribePostHandler("distribuidora");

    const res = await POST(
      fakeRequest({ endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } }),
    );

    expect(fromCalls[0]).toBe("push_subscriptions");
    expect(upsertMock).toHaveBeenCalledWith(
      { channel: "distribuidora", endpoint: "https://push.example/abc", p256dh: "p", auth: "a" },
      { onConflict: "endpoint" },
    );
    expect(res.status).toBe(200);
  });

  it("retorna 400 quando falta endpoint ou keys", async () => {
    const POST = createPushSubscribePostHandler("distribuidora");
    const res = await POST(fakeRequest({ endpoint: "", keys: { p256dh: "p", auth: "a" } }));
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("retorna 500 genérico quando o Supabase falha", async () => {
    upsertMock.mockResolvedValue({ error: { message: "conexão recusada" } });
    const POST = createPushSubscribePostHandler("distribuidora");
    const res = await POST(
      fakeRequest({ endpoint: "https://push.example/abc", keys: { p256dh: "p", auth: "a" } }),
    );
    expect(res.status).toBe(500);
  });
});

describe("sendPushBroadcast", () => {
  it("lança erro quando as chaves VAPID não estão configuradas", async () => {
    await expect(
      sendPushBroadcast("distribuidora", { title: "T", body: "B" }),
    ).rejects.toThrow(/PUSH_VAPID/);
  });

  it("envia para todas as inscrições do canal e conta os enviados", async () => {
    vi.stubEnv("PUSH_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("PUSH_VAPID_PRIVATE_KEY", "priv");
    vi.stubEnv("PUSH_VAPID_SUBJECT", "mailto:teste@exemplo.com");
    selectEqMock.mockResolvedValue({
      data: [
        { id: "1", endpoint: "https://push.example/a", p256dh: "p1", auth: "a1" },
        { id: "2", endpoint: "https://push.example/b", p256dh: "p2", auth: "a2" },
      ],
      error: null,
    });
    sendNotificationMock.mockResolvedValue(undefined);

    const result = await sendPushBroadcast("distribuidora", { title: "T", body: "B" });

    expect(setVapidDetailsMock).toHaveBeenCalledWith("mailto:teste@exemplo.com", "pub", "priv");
    expect(sendNotificationMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ sent: 2, removed: 0 });
  });

  it("remove a inscrição quando o envio falha com 410 (expirada)", async () => {
    vi.stubEnv("PUSH_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("PUSH_VAPID_PRIVATE_KEY", "priv");
    vi.stubEnv("PUSH_VAPID_SUBJECT", "mailto:teste@exemplo.com");
    selectEqMock.mockResolvedValue({
      data: [{ id: "1", endpoint: "https://push.example/a", p256dh: "p1", auth: "a1" }],
      error: null,
    });
    deleteEqMock.mockResolvedValue({ error: null });
    sendNotificationMock.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));

    const result = await sendPushBroadcast("distribuidora", { title: "T", body: "B" });

    expect(deleteEqMock).toHaveBeenCalledWith("id", "1");
    expect(result).toEqual({ sent: 0, removed: 1 });
  });

  it("não remove a inscrição em erro que não seja 404/410", async () => {
    vi.stubEnv("PUSH_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("PUSH_VAPID_PRIVATE_KEY", "priv");
    vi.stubEnv("PUSH_VAPID_SUBJECT", "mailto:teste@exemplo.com");
    selectEqMock.mockResolvedValue({
      data: [{ id: "1", endpoint: "https://push.example/a", p256dh: "p1", auth: "a1" }],
      error: null,
    });
    sendNotificationMock.mockRejectedValue(
      Object.assign(new Error("erro temporário"), { statusCode: 500 }),
    );

    const result = await sendPushBroadcast("distribuidora", { title: "T", body: "B" });

    expect(deleteEqMock).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 0, removed: 0 });
  });
});
