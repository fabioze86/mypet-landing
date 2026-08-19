export const ALL_CHANNEL_KINDS = ["mypetbrasil", "distribuidora", "azpetshop", "ffa_fabrica"] as const;

export const CHANNELS = ALL_CHANNEL_KINDS;

export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  mypetbrasil: "My Pet Brasil",
  distribuidora: "Distribuidora",
  azpetshop: "AZ Petshop",
  ffa_fabrica: "FFA Fábrica",
};

export function isChannel(value: unknown): value is Channel {
  return typeof value === "string" && (CHANNELS as readonly string[]).includes(value);
}
