import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientConfigProvider } from "../theme";
import { OfferPrice } from "./offer-price";
import { testClientConfig } from "../test-utils/client-config";

describe("OfferPrice", () => {
  it("exibe preço de tabela riscado, preço promocional e percentual de desconto", () => {
    render(
      <ClientConfigProvider config={testClientConfig}>
        <OfferPrice listPrice={299} promotionalPrice={199} discountPercentage={33} />
      </ClientConfigProvider>,
    );
    expect(screen.getByText("R$ 299,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 199,00")).toBeInTheDocument();
    expect(screen.getByText("-33%")).toBeInTheDocument();
  });

  it("não exibe o preço riscado quando é igual ao promocional", () => {
    render(
      <ClientConfigProvider config={testClientConfig}>
        <OfferPrice listPrice={199} promotionalPrice={199} discountPercentage={0} />
      </ClientConfigProvider>,
    );
    expect(screen.queryByText("-0%")).not.toBeInTheDocument();
  });
});
