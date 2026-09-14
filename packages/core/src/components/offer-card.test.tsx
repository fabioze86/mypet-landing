// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientConfigProvider } from "../theme";
import { CartProvider } from "./cart-provider";
import { OfferCard } from "./offer-card";
import { testClientConfig } from "../test-utils/client-config";
import type { OfferItem } from "../offers-calc";

const item: OfferItem = {
  id: "item-1",
  productId: "prod-1",
  cpro: "SKU-1",
  name: "Kit 11 vestidos",
  shortDescription: "Kit com 11 vestidos sortidos.",
  img: "/kit.jpg",
  listPrice: 299,
  promotionalPrice: 199,
  discountPercentage: 33,
  minQuantity: 1,
  sortOrder: 0,
};

function renderCard(campaignSlug = "kit-11-vestidos") {
  return render(
    <ClientConfigProvider config={testClientConfig}>
      <CartProvider>
        <OfferCard item={item} campaignId="camp-1" campaignSlug={campaignSlug} />
      </CartProvider>
    </ClientConfigProvider>,
  );
}

describe("OfferCard", () => {
  it("exibe nome, preço promocional e link para a landing da campanha", () => {
    renderCard();
    expect(screen.getByText("Kit 11 vestidos")).toBeInTheDocument();
    expect(screen.getByText("R$ 199,00")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Kit 11 vestidos/i });
    expect(link).toHaveAttribute("href", "/ofertas-para-lojistas/kit-11-vestidos");
  });
});
