import { formatCnpj, formatWhatsapp } from "@mypet/core/br-validation";
import { EMPRESA, enderecoEmLinha } from "./empresa";

export type PoliticaSlug = "troca-e-devolucao" | "privacidade" | "entrega" | "pagamento";

export type Politica = {
  slug: PoliticaSlug;
  titulo: string;
  resumo: string;
  secoes: { titulo: string; paragrafos: string[] }[];
};

const empresa = `${EMPRESA.razaoSocial}, CNPJ ${formatCnpj(EMPRESA.cnpj)}, com sede em ${enderecoEmLinha(EMPRESA.endereco)}`;
const contato = `pelo e-mail ${EMPRESA.email} ou pelo WhatsApp ${formatWhatsapp(EMPRESA.whatsapp)} (${EMPRESA.horario})`;

// Rascunho para revisão jurídica do usuário antes do deploy de produção.
export const POLITICAS: Politica[] = [
  {
    slug: "troca-e-devolucao",
    titulo: "Trocas e devoluções",
    resumo: "Como desistir de uma compra, trocar um produto ou devolver um item com defeito.",
    secoes: [
      {
        titulo: "Direito de arrependimento",
        paragrafos: [
          "Você pode desistir da compra em até 7 (sete) dias corridos contados do recebimento do pedido, sem precisar justificar, conforme o artigo 49 do Código de Defesa do Consumidor.",
          "O produto deve ser devolvido com todos os acessórios e, sempre que possível, na embalagem original. Após recebermos e conferirmos o item, devolvemos o valor integral pago, incluindo o frete de envio.",
        ],
      },
      {
        titulo: "Produto com defeito ou avaria",
        paragrafos: [
          "Se o produto chegar com defeito, avaria ou diferente do pedido, avise em até 30 (trinta) dias do recebimento. Enviamos as instruções de devolução sem custo para você e, após a conferência, trocamos o item ou devolvemos o valor, como você preferir.",
        ],
      },
      {
        titulo: "Como solicitar",
        paragrafos: [
          `Entre em contato ${contato}, informando o número do pedido e o motivo. Respondemos com as instruções e o código de postagem.`,
          "O reembolso é feito pelo mesmo meio de pagamento: Pix devolvido na conta de origem em até 5 dias úteis após a conferência; no cartão, o estorno aparece na fatura conforme o prazo da operadora.",
        ],
      },
    ],
  },
  {
    slug: "privacidade",
    titulo: "Política de privacidade",
    resumo: "Quais dados coletamos, para que usamos e como você exerce seus direitos pela LGPD.",
    secoes: [
      {
        titulo: "Quem trata seus dados",
        paragrafos: [
          `A controladora dos dados pessoais coletados nesta loja é ${empresa}, que opera a marca ${EMPRESA.nomeFantasia}.`,
        ],
      },
      {
        titulo: "Dados coletados e finalidade",
        paragrafos: [
          "No pedido coletamos nome, CPF, e-mail, telefone/WhatsApp e endereço de entrega, usados para processar o pagamento, emitir a nota fiscal, entregar o pedido e falar com você sobre ele.",
          "Os dados de cartão são digitados diretamente no ambiente do nosso processador de pagamentos e não ficam armazenados na loja.",
          "Usamos cookies e ferramentas de análise (como o Google Analytics) para medir o uso do site e melhorar a experiência.",
        ],
      },
      {
        titulo: "Compartilhamento",
        paragrafos: [
          "Compartilhamos apenas o necessário com o processador de pagamentos, a plataforma de frete e as transportadoras, e com autoridades quando a lei exigir. Não vendemos seus dados.",
        ],
      },
      {
        titulo: "Seus direitos",
        paragrafos: [
          `Pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018) você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, ${contato}. Dados exigidos por obrigação legal ou fiscal são mantidos pelo prazo que a lei determina.`,
        ],
      },
    ],
  },
  {
    slug: "entrega",
    titulo: "Política de entrega",
    resumo: "Para onde entregamos, como o frete é calculado e como acompanhar o pedido.",
    secoes: [
      {
        titulo: "Área de entrega",
        paragrafos: ["Entregamos em todo o Brasil, por Correios e transportadoras parceiras."],
      },
      {
        titulo: "Frete e prazo",
        paragrafos: [
          "O valor do frete e o prazo de entrega são calculados pelo CEP no checkout, antes do pagamento, e você escolhe a opção que preferir.",
          "O prazo começa a contar a partir da confirmação do pagamento. Pagamentos por Pix costumam ser confirmados em minutos; por cartão, após a aprovação da operadora.",
        ],
      },
      {
        titulo: "Rastreio",
        paragrafos: [
          "Quando o pedido é despachado, enviamos o código de rastreio por e-mail e WhatsApp. Ele também aparece na página do seu pedido.",
        ],
      },
      {
        titulo: "Problemas na entrega",
        paragrafos: [
          `Se o pedido atrasar, for extraviado ou chegar danificado, fale com a gente ${contato}. Resolvemos com a transportadora e, se necessário, reenviamos o produto ou devolvemos o valor.`,
        ],
      },
    ],
  },
  {
    slug: "pagamento",
    titulo: "Formas de pagamento",
    resumo: "Pix e cartão de crédito em ambiente seguro, com parcelamento sem juros.",
    secoes: [
      {
        titulo: "Meios aceitos",
        paragrafos: [
          "Aceitamos Pix e cartão de crédito. O pagamento é processado pelo Asaas, instituição de pagamento autorizada pelo Banco Central, em página segura.",
        ],
      },
      {
        titulo: "Parcelamento",
        paragrafos: [
          "No cartão, o parcelamento é sem juros. O número de parcelas disponível aparece na página de cada produto e no pagamento.",
        ],
      },
      {
        titulo: "Confirmação",
        paragrafos: [
          "O pedido é separado depois da confirmação do pagamento. O Pix gerado vale por tempo limitado; se não for pago, o pedido é cancelado automaticamente e nada é cobrado.",
        ],
      },
      {
        titulo: "Finalizar pelo WhatsApp",
        paragrafos: [
          "Se preferir, você pode finalizar o pedido pelo WhatsApp: nossa equipe confirma os itens, o frete e o prazo e envia o link de pagamento.",
        ],
      },
    ],
  },
];

export function getPolitica(slug: string): Politica | undefined {
  return POLITICAS.find((p) => p.slug === slug);
}
