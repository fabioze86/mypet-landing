import type { ComponentType } from "react";
import {
  CreditCard,
  CurrencyCircleDollar,
  IdentificationCard,
  LockKeyOpen,
  Package,
  ShoppingCart,
  Star,
  Truck,
  Headset,
  Storefront,
  Stack,
} from "@phosphor-icons/react/dist/ssr";
import type { IconProps } from "@phosphor-icons/react";

const MAP: Record<string, ComponentType<IconProps>> = {
  CreditCard,
  CurrencyCircleDollar,
  IdentificationCard,
  LockKeyOpen,
  Package,
  ShoppingCart,
  Star,
  Truck,
  Headset,
  Storefront,
  Stack,
};

export function PaIcon({
  name,
  size = 24,
  weight = "duotone",
}: {
  name: string;
  size?: number;
  weight?: IconProps["weight"];
}) {
  const Cmp = MAP[name];
  if (!Cmp) return null;
  return <Cmp size={size} weight={weight} aria-hidden />;
}
