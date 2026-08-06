import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

const upsertMock = vi.fn();
const fromCalls: string[] = [];

vi.mock("./supabase", () => ({
  getHubClient: () => ({
    from: (table: string) => {
      fromCalls.push(table);
      return { upsert: upsertMock };
    },
  }),
}));

import { createPushSubscribePostHandler } from "./push-server";

function fakeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

function fakeInvalidJsonRequest(): NextRequest {
  return {
    json: async () => {
      throw new SyntaxError("Unexpected token");
    },
  } as unknown as NextRequest;
}

const validEndpoint = "https://fcm.googleapis.com/fcm/send/abc123";

beforeEach(() => {
  upsertMock.mockReset();
  fromCalls.length = 0;
});

describe("createPushSubscribePostHandler", () => {
  it("grava a subscription na tabela push_subscriptions com upsert por endpoint", async () => {
    upsertMock.mockResolvedValue({ error: null });
    const POST = createPushSubscribePostHandler("distribuidora");

    const res = await POST(
      fakeRequest({ endpoint: validEndpoint, keys: { p256dh: "p", auth: "a" } }),
    );

    expect(fromCalls[0]).toBe("push_subscriptions");
    expect(upsertMock).toHaveBeenCalledWith(
      { channel: "distribuidora", endpoint: validEndpoint, p256dh: "p", auth: "a" },
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

  it("retorna 400 quando o endpoint não é de um push service conhecido", async () => {
    const POST = createPushSubscribePostHandler("distribuidora");
    const res = await POST(
      fakeRequest({ endpoint: "https://evil.example.com/abc", keys: { p256dh: "p", auth: "a" } }),
    );
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o endpoint não é https", async () => {
    const POST = createPushSubscribePostHandler("distribuidora");
    const res = await POST(
      fakeRequest({
        endpoint: "http://fcm.googleapis.com/fcm/send/abc",
        keys: { p256dh: "p", auth: "a" },
      }),
    );
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("retorna 400 quando o corpo não é JSON válido", async () => {
    const POST = createPushSubscribePostHandler("distribuidora");
    const res = await POST(fakeInvalidJsonRequest());
    expect(res.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("retorna 500 genérico quando o Supabase falha", async () => {
    upsertMock.mockResolvedValue({ error: { message: "conexão recusada" } });
    const POST = createPushSubscribePostHandler("distribuidora");
    const res = await POST(
      fakeRequest({ endpoint: validEndpoint, keys: { p256dh: "p", auth: "a" } }),
    );
    expect(res.status).toBe(500);
  });
});
