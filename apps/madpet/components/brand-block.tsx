import { madPetPalette as palette } from "@/client-theme";

export function BrandBlock() {
  return (
    <section style={{ maxWidth: 780, margin: "0 auto", padding: "48px 24px", textAlign: "center" }}>
      <p style={{ fontSize: 18, color: palette.gray800, lineHeight: 1.7, fontWeight: 600 }}>
        A MAD PET nasceu de uma pergunta simples: por que acessório pet tem que ser sem graça?
        Fabricamos nossas próprias bandanas, laços, peitorais e coleiras com cores que ninguém
        esquece e um preço que cabe no bolso — sem abrir mão da qualidade que seu pet merece.
      </p>
    </section>
  );
}
