// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientConfigProvider } from "../theme";
import { CampaignCountdown } from "./campaign-countdown";
import { testClientConfig } from "../test-utils/client-config";

describe("CampaignCountdown", () => {
  it("não renderiza nada quando não há endsAt", () => {
    const { container } = render(
      <ClientConfigProvider config={testClientConfig}>
        <CampaignCountdown endsAt={null} />
      </ClientConfigProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada quando endsAt já passou", () => {
    const { container } = render(
      <ClientConfigProvider config={testClientConfig}>
        <CampaignCountdown endsAt="2020-01-01T00:00:00Z" />
      </ClientConfigProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza a contagem quando há uma data futura", () => {
    const future = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    render(
      <ClientConfigProvider config={testClientConfig}>
        <CampaignCountdown endsAt={future} />
      </ClientConfigProvider>,
    );
    expect(screen.getByTestId("campaign-countdown")).toBeInTheDocument();
  });
});
