export type Testimonial = {
  name: string;
  city: string;
  quote: string;
};

/**
 * Depoimentos placeholder de lojistas. Trocar por depoimentos reais de pet
 * shops que revendem MAD PET quando disponíveis.
 */
export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Camila Rocha",
    city: "Petland — Curitiba/PR",
    quote:
      "A bandana MAD PET é a que mais sai da minha vitrine. Cliente pega no impulso, no caixa, sem eu precisar oferecer.",
  },
  {
    name: "Rodrigo Alves",
    city: "Mundo Pet — Sorocaba/SP",
    quote:
      "Reposição rápida e sem furo de estoque. Peço pelo WhatsApp de manhã e já fecho a condição na hora.",
  },
  {
    name: "Fernanda Lima",
    city: "Cão & Cia — Belo Horizonte/MG",
    quote:
      "O peitoral tem acabamento de marca cara e preço que me deixa margem folgada. Virou item fixo da loja.",
  },
  {
    name: "Marcos Tavares",
    city: "Pet Center — Florianópolis/SC",
    quote:
      "Comecei com o kit de vitrine e em duas semanas já tinha refeito o pedido. Gira de verdade.",
  },
  {
    name: "Patrícia Nunes",
    city: "AuAu Pet Shop — Campinas/SP",
    quote:
      "Coleira e guia combinando puxam a venda casada. O cliente leva o conjunto quase sempre.",
  },
];
