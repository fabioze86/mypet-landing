import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const selectEqMock = vi.fn();
const deleteEqMock = vi.fn();
const fromCalls: string[] = [];

vi.mock("./supabase", () => ({
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

import { sendPushBroadcast } from "./push-broadcast";

beforeEach(() => {
  selectEqMock.mockReset();
  deleteEqMock.mockReset();
  sendNotificationMock.mockReset();
  setVapidDetailsMock.mockReset();
  fromCalls.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
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
