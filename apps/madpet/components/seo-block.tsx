import { madPetPalette as palette } from "@/client-theme";
import { PRODUCT_LINES } from "@/lib/product-lines";

const SEO_CONTENT: Record<string, { p1: string; p2: string }> = {
  bandanas: {
    p1: "As bandanas MAD PET são feitas em tecido resistente e de fácil lavagem, pensadas pra aguentar o dia a dia de cães e gatos de todos os portes. Disponíveis em estampas exclusivas, elas se ajustam com um simples nó no pescoço, sem fivela e sem risco de aperto.",
    p2: "É a escolha certa pra quem quer dar um upgrade no visual do pet sem gastar muito: usa no passeio, na festa, no dia a dia — e troca quando quiser, porque tem estampa nova sempre.",
  },
  lacos: {
    p1: "Os laços MAD PET são pequenos, leves e prendem fácil na coleira ou direto no pelo, sem machucar. Ideais pra cães e gatos de pequeno a grande porte que gostam de andar com estilo.",
    p2: "Perfeitos pra ocasiões especiais — aniversário, ensaio de foto, passeio no shopping — mas resistentes o bastante pro uso diário também.",
  },
  peitorais: {
    p1: "Os peitorais MAD PET distribuem a força da guiada pelo peito e não pelo pescoço, com ajuste em velcro ou fivela e reforço nas costuras. Disponíveis em vários tamanhos, do mini ao extra grande.",
    p2: "Indicados pra cães que puxam na guia ou têm o pescoço sensível (como raças braquicefálicas), unindo conforto no passeio com o colorido que é a cara da marca.",
  },
  coleiras: {
    p1: "As coleiras MAD PET vêm em cores vibrantes e materiais resistentes à água e ao desgaste do dia a dia, com fivela de encaixe rápido e argola reforçada pra guia e identificação.",
    p2: "Tamanhos ajustáveis pra cães e gatos de qualquer porte, com o mesmo padrão de qualidade e preço-benefício de fabricação própria que é a cara da MAD PET.",
  },
};

export function SeoBlock() {
  return (
    <section style={{ maxWidth: 860, margin: "0 auto", padding: "64px 24px" }}>
      <h2 style={{ fontSize: 30, fontWeight: 900, color: palette.purple, marginBottom: 16 }}>
        MAD PET: acessórios de fabricação própria para cachorros e gatos
      </h2>
      <p style={{ fontSize: 16, color: palette.gray800, lineHeight: 1.7, marginBottom: 40 }}>
        A MAD PET é a linha própria de acessórios do Grupo AZ, fabricada com foco em cor,
        conforto e preço-benefício. Bandanas, laços, peitorais e coleiras pensados pra cães e
        gatos de todos os tamanhos, com materiais resistentes e visual que ninguém passa
        despercebido.
      </p>
      {PRODUCT_LINES.map((line) => (
        <div key={line.slug} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: palette.gray800, marginBottom: 10 }}>
            <a href={`#${line.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
              {line.label}
            </a>
          </h2>
          <p style={{ fontSize: 15, color: palette.gray600, lineHeight: 1.7, marginBottom: 10 }}>
            {SEO_CONTENT[line.slug].p1}
          </p>
          <p style={{ fontSize: 15, color: palette.gray600, lineHeight: 1.7 }}>{SEO_CONTENT[line.slug].p2}</p>
        </div>
      ))}
    </section>
  );
}
