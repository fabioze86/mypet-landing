import { madPetPalette as palette } from "@/client-theme";
import { PRODUCT_LINES } from "@/lib/product-lines";

const SEO_CONTENT: Record<string, { p1: string; p2: string }> = {
  bandanas: {
    p1: "As bandanas MAD PET são feitas em tecido resistente e de fácil lavagem, com estampas exclusivas e ajuste por nó, sem fivela. Chegam prontas para expor, em grade fechada por tamanho, ideais para giro rápido no balcão e na vitrine.",
    p2: "Para o lojista, é o item de ticket baixo que o cliente leva por impulso: troca de estampa constante, reposição simples e margem folgada por ser de fabricação própria.",
  },
  lacos: {
    p1: "Os laços MAD PET prendem na coleira ou no pelo sem machucar, em modelos para cães e gatos de pequeno a grande porte. Vêm em cartela organizada por cor, o que facilita a exposição perto do caixa.",
    p2: "É complemento de venda com boa saída em datas comemorativas e serviços de banho e tosa, com preço de atacado que permite kit e combo na sua loja.",
  },
  peitorais: {
    p1: "Os peitorais MAD PET distribuem a força da guiada pelo peito, com ajuste em fivela, reforço nas costuras e grade do mini ao extra grande. Produto de maior valor agregado na linha de passeio.",
    p2: "Indicado para lojas que atendem tutores de cães que puxam na guia ou de raças braquicefálicas, unindo argumento de venda técnico com o colorido da marca.",
  },
  coleiras: {
    p1: "As coleiras MAD PET usam materiais resistentes à água e ao desgaste, com fivela de encaixe rápido e argola reforçada. Tamanhos ajustáveis cobrem cães e gatos de qualquer porte com poucos SKUs.",
    p2: "É o item de recompra da linha: combina com guia e peitoral, tem cor que puxa a venda casada e o mesmo padrão de fabricação própria com preço de revenda.",
  },
};

export function SeoBlock() {
  return (
    <section style={{ background: palette.purpleLight }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "72px 24px" }}>
        <h2 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, color: palette.gray800, marginBottom: 16, lineHeight: 1.2 }}>
          MAD PET: fornecedor de acessórios pet de fabricação própria para revenda
        </h2>
        <p style={{ fontSize: 16, color: palette.gray800, lineHeight: 1.7, marginBottom: 40 }}>
          A MAD PET é a linha própria de acessórios do Grupo AZ, voltada para pet shops, agropecuárias
          e lojistas que querem margem de atacado sem depender de importação. Bandanas, laços,
          peitorais e coleiras para cães e gatos de todos os tamanhos, com material resistente,
          grade fechada e reposição rápida.
        </p>
        {PRODUCT_LINES.map((line) => (
          <div key={line.slug} style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 19, fontWeight: 800, color: palette.gray800, marginBottom: 10 }}>
              <a href={`#${line.slug}`} className="mp-link" style={{ color: "inherit", textDecoration: "none" }}>
                {line.label} para revenda
              </a>
            </h3>
            <p style={{ fontSize: 15, color: palette.gray600, lineHeight: 1.7, marginBottom: 10 }}>
              {SEO_CONTENT[line.slug].p1}
            </p>
            <p style={{ fontSize: 15, color: palette.gray600, lineHeight: 1.7 }}>{SEO_CONTENT[line.slug].p2}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
