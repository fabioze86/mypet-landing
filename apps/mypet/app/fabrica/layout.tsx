import { CartProvider } from "@mypet/core/components/cart-provider";
import { VitrinePathProvider } from "@mypet/core/components/vitrine-path";
import { VITRINES } from "@/lib/vitrines";

// Tudo dentro de /fabrica usa o carrinho e os links da Linha de Fábrica.
export default function FabricaLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider storageKey={VITRINES.fabrica.cartKey}>
      <VitrinePathProvider basePath={VITRINES.fabrica.basePath}>{children}</VitrinePathProvider>
    </CartProvider>
  );
}
