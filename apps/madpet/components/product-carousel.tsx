"use client";

import { useRef } from "react";
import type { CatalogProduct } from "@mypet/core/catalog-utils";
import { ProductCard } from "./product-card";
import { madPetPalette as palette } from "@/client-theme";

const arrowBaseStyle: React.CSSProperties = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: 40,
  height: 40,
  borderRadius: "50%",
  border: "none",
  background: palette.purple,
  color: palette.white,
  fontSize: 22,
  cursor: "pointer",
  alignItems: "center",
  justifyContent: "center",
};

export function ProductCarousel({
  products,
  whatsappNumber,
}: {
  products: CatalogProduct[];
  whatsappNumber: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: 1 | -1) {
    trackRef.current?.scrollBy({ left: direction * 260, behavior: "smooth" });
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={trackRef}
        style={{
          display: "flex",
          gap: 16,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          paddingBottom: 8,
        }}
      >
        {products.map((product) => (
          <ProductCard key={product.id} product={product} whatsappNumber={whatsappNumber} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => scrollByCard(-1)}
        aria-label="Ver produtos anteriores"
        className="carousel-arrow"
        style={{ ...arrowBaseStyle, left: -8 }}
      >
        ‹
      </button>
      <button
        type="button"
        onClick={() => scrollByCard(1)}
        aria-label="Ver próximos produtos"
        className="carousel-arrow"
        style={{ ...arrowBaseStyle, right: -8 }}
      >
        ›
      </button>
    </div>
  );
}
