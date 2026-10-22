import { cache } from "react";
import { cookies } from "next/headers";
import { getHubServiceClient } from "@mypet/core/supabase";
import { getBuyerById } from "@mypet/core/buyers-server";
import { verifyAccessToken, ACCESS_COOKIE } from "@mypet/core/access-session";
import type { Buyer } from "@mypet/core/buyers-server";

// cache() por requisição: HubHeaderSlot e o conteúdo da página verificam o cookie uma vez só
export const requireBuyer = cache(async (): Promise<Buyer | null> => {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  let payload: { buyerId: string } | null;
  try {
    payload = verifyAccessToken(token);
  } catch {
    payload = null;
  }
  if (!payload) return null;
  return getBuyerById(getHubServiceClient(), payload.buyerId);
});
