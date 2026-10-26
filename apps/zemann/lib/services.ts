import type { FaqItem } from "./content";

export type ServiceKey =
  | "amazon"
  | "seo"
  | "trafego-pago"
  | "cro"
  | "email-marketing"
  | "ux"
  | "social-media"
  | "assessoria";

export type AgencyServiceKey = Exclude<ServiceKey, "amazon">;

export type ServiceCard = { title: string; text: string };

export type ServiceInfo = {
  key: AgencyServiceKey;
  name: string;
  path: string;
  title: string;
  description: string;
  nav: string;
  summary: string;
  intro: string;
  audiences: ServiceCard[];
  includes: ServiceCard[];
  steps: ServiceCard[];
  connections: { key: ServiceKey; text: string }[];
  faq: FaqItem[];
};

export type ServiceSummary = { key: ServiceKey; name: string; path: string; summary: string };

// Catálogo dos serviços da agência (exceto Amazon, que tem páginas próprias).
// Regras de copy: sem números, clientes ou resultados inventados e sem selos
// que a Zemann não tem (ver spec 2026-10-25, seção 9).
export const SERVICES: Record<AgencyServiceKey, ServiceInfo> = {
  seo: {
    key: "seo",
    name: "SEO",
    path: "/seo-para-ecommerce",
    title: "SEO para e-commerce: tráfego orgânico que vende",
    description:
      "SEO para lojas virtuais e marcas: estrutura técnica, páginas de categoria e produto, conteúdo e links internos para atrair visitas que compram.",
    nav: "SEO para e-commerce",
    summary: "Mais visitas orgânicas nas páginas que vendem",
    intro:
      "Busca orgânica é o canal que continua trazendo visitas depois que a campanha acaba. Nosso time cuida da parte técnica da loja, das páginas de categoria e de produto e do conteúdo que responde às dúvidas de quem está perto de comprar.",
    audiences: [
      { title: "Lojas que dependem de mídia paga", text: "Quando quase toda venda vem de anúncio, cada pausa na verba derruba o faturamento. O orgânico reduz essa dependência." },
      { title: "Marcas com catálogo grande", text: "Milhares de páginas de produto e categoria pedem regras claras de título, descrição, filtros e indexação." },
      { title: "Lojas que vão migrar de plataforma", text: "Uma migração sem plano de redirecionamento perde posições que levaram anos para conquistar." },
    ],
    includes: [
      { title: "Auditoria técnica", text: "Rastreamento, indexação, velocidade, dados estruturados, páginas duplicadas e erros que impedem o Google de ler a loja." },
      { title: "Categorias e produtos", text: "Títulos, descrições e textos de categoria escritos para a busca real do cliente, sem repetir a ficha do fabricante." },
      { title: "Pesquisa de palavras-chave", text: "Mapa de termos por intenção de compra, ligado às páginas que devem ranquear para cada um." },
      { title: "Conteúdo que apoia a venda", text: "Guias e comparativos que respondem às dúvidas antes da compra e levam o leitor para o produto." },
      { title: "Links internos e arquitetura", text: "Menu, filtros e links entre páginas organizados para distribuir autoridade e facilitar a navegação." },
    ],
    steps: [
      { title: "Diagnóstico", text: "Levantamos a situação técnica, as páginas que já trazem visitas e as oportunidades de busca do seu nicho." },
      { title: "Plano priorizado", text: "Ordenamos as correções e os conteúdos por impacto esperado e esforço, para começar pelo que destrava mais." },
      { title: "Execução", text: "Nosso time implementa junto com quem cuida da loja, com cada alteração registrada." },
      { title: "Acompanhamento", text: "Relatórios de posições, cliques e receita orgânica, com ajustes no plano conforme os dados." },
    ],
    connections: [
      { key: "cro", text: "Visita orgânica só vira venda se a página converte. CRO e SEO trabalham nas mesmas páginas." },
      { key: "ux", text: "Arquitetura e navegação claras ajudam o Google e o cliente ao mesmo tempo." },
      { key: "amazon", text: "Na Amazon, título, atributos e conteúdo do anúncio também decidem quem aparece na busca." },
    ],
    faq: [
      { q: "Em quanto tempo o SEO traz resultado?", a: "Depende da situação da loja e da concorrência do nicho. Correções técnicas costumam aparecer antes; conteúdo e autoridade levam mais tempo. Mostramos a evolução em relatórios desde o começo." },
      { q: "Vocês escrevem o conteúdo ou só orientam?", a: "Escrevemos. O plano inclui títulos, descrições, textos de categoria e guias, revisados com o seu time antes de publicar." },
      { q: "Funciona em qualquer plataforma de loja?", a: "Sim. Adaptamos o trabalho aos limites de cada plataforma e indicamos o que depende de desenvolvedor." },
    ],
  },
  "trafego-pago": {
    key: "trafego-pago",
    name: "Tráfego pago",
    path: "/trafego-pago-para-ecommerce",
    title: "Tráfego pago para e-commerce: Google e Meta Ads",
    description:
      "Gestão de Google Ads e Meta Ads para e-commerce com foco em margem: estrutura de campanhas, catálogo de produtos, criativos e mensuração confiável.",
    nav: "Tráfego pago",
    summary: "Google Ads e Meta Ads guiados por margem",
    intro:
      "Anúncio que vende muito e não deixa lucro não resolve. Nosso time monta e opera campanhas de Google Ads e Meta Ads olhando a margem de cada produto, com mensuração conferida antes de qualquer decisão de verba.",
    audiences: [
      { title: "Lojas que já investem em mídia", text: "Quando o custo por venda sobe e ninguém sabe dizer por quê, a estrutura e a mensuração das campanhas são o primeiro lugar a olhar." },
      { title: "Marcas que vão começar a anunciar", text: "Começar com conversões medidas do jeito certo evita meses de otimização em cima de dados errados." },
      { title: "Operações com muitos produtos", text: "Catálogos grandes pedem campanhas de shopping e de catálogo bem segmentadas, e não um conjunto único para tudo." },
    ],
    includes: [
      { title: "Mensuração", text: "Conferência das conversões, da integração com a loja e da atribuição antes de mexer em campanhas." },
      { title: "Google Ads", text: "Pesquisa, Shopping e Performance Max com feed de produtos organizado e termos negativos revisados." },
      { title: "Meta Ads", text: "Campanhas de catálogo, públicos e remarketing no Facebook e no Instagram." },
      { title: "Criativos", text: "Direção de criativos e testes de mensagem, com aprendizado registrado para as próximas campanhas." },
      { title: "Verba por margem", text: "Distribuição do investimento pelos produtos e campanhas que deixam lucro, não só faturamento." },
    ],
    steps: [
      { title: "Auditoria das contas", text: "Revisamos estrutura, mensuração, feed e histórico de resultados das contas atuais." },
      { title: "Plano de mídia", text: "Definimos objetivos, divisão de verba e prioridades de teste com o seu time." },
      { title: "Operação", text: "Ajustes contínuos de lances, públicos, termos e criativos." },
      { title: "Relatório", text: "Leitura de custo, receita e margem por campanha, com as próximas decisões propostas." },
    ],
    connections: [
      { key: "cro", text: "Melhorar a conversão da loja baixa o custo de cada venda que vem do anúncio." },
      { key: "email-marketing", text: "Quem chegou pelo anúncio e não comprou pode voltar por e-mail, sem pagar de novo pelo clique." },
      { key: "amazon", text: "Para quem vende na Amazon, o Amazon Ads entra no mesmo plano de verba e margem." },
    ],
    faq: [
      { q: "Qual verba mínima para começar?", a: "Depende do ticket, da margem e do nicho. No diagnóstico indicamos uma verba inicial que permita aprender sem desperdício." },
      { q: "A verba de mídia está incluída na gestão?", a: "Não. A verba é paga direto às plataformas, na conta da sua empresa. A gestão do nosso time é cobrada à parte." },
      { q: "As contas de anúncio ficam com quem?", a: "Com a sua empresa. Trabalhamos com acesso concedido por você, que pode ser revogado a qualquer momento." },
    ],
  },
  cro: {
    key: "cro",
    name: "CRO",
    path: "/cro-otimizacao-de-conversao",
    title: "CRO: otimização de conversão para e-commerce",
    description:
      "CRO para lojas virtuais: análise de funil, pesquisa com clientes e testes nas páginas de produto, carrinho e checkout para vender mais com o mesmo tráfego.",
    nav: "CRO",
    summary: "Mais vendas com o tráfego que você já tem",
    intro:
      "Antes de pagar por mais visitas, vale descobrir por que as visitas atuais não compram. Nosso time analisa o funil da loja, conversa com os dados e com os clientes e testa mudanças onde a perda é maior.",
    audiences: [
      { title: "Lojas com tráfego e poucas vendas", text: "Muita gente entra, pouca gente compra. O problema costuma estar em pontos específicos do funil." },
      { title: "Operações com mídia cara", text: "Cada ganho de conversão reduz o custo de todas as campanhas ao mesmo tempo." },
      { title: "Marcas que lançaram loja nova", text: "Uma loja recém-lançada ainda não foi validada com comprador de verdade." },
    ],
    includes: [
      { title: "Análise de funil", text: "Onde os visitantes abandonam: listagem, produto, carrinho, frete ou pagamento." },
      { title: "Pesquisa com clientes", text: "Gravações de sessão, mapas de calor e perguntas curtas para entender o que trava a compra." },
      { title: "Hipóteses priorizadas", text: "Lista de mudanças ordenada por impacto esperado, confiança e esforço." },
      { title: "Testes", text: "Testes A/B quando o volume permite; quando não permite, mudanças acompanhadas com antes e depois." },
      { title: "Página de produto e checkout", text: "Informação de frete, prazo, troca e pagamento no lugar certo, sem distração no caminho da compra." },
    ],
    steps: [
      { title: "Medição", text: "Conferimos se os eventos do funil estão medidos corretamente." },
      { title: "Diagnóstico", text: "Cruzamos dados quantitativos e pesquisa para achar onde a loja perde mais vendas." },
      { title: "Testes", text: "Implementamos e acompanhamos as mudanças em ciclos." },
      { title: "Aprendizado", text: "Cada resultado vira regra para as próximas páginas e campanhas." },
    ],
    connections: [
      { key: "ux", text: "UX resolve problemas estruturais de navegação; CRO mede e testa o efeito nas vendas." },
      { key: "trafego-pago", text: "Com a loja convertendo melhor, cada real investido em anúncio rende mais." },
      { key: "seo", text: "As páginas que recebem visitas orgânicas são as primeiras candidatas a teste." },
    ],
    faq: [
      { q: "Preciso de muito tráfego para fazer CRO?", a: "Para testes A/B com segurança estatística, sim. Com menos volume, trabalhamos com pesquisa, boas práticas e acompanhamento de antes e depois." },
      { q: "Vocês mexem no código da loja?", a: "Fazemos o que a plataforma permite pelo painel e por ferramentas de teste. Mudanças maiores são especificadas para o seu desenvolvedor." },
      { q: "Qual a diferença entre CRO e UX?", a: "UX olha a experiência inteira de quem compra. CRO foca em medir e aumentar a taxa de conversão. Os dois andam juntos." },
    ],
  },
  "email-marketing": {
    key: "email-marketing",
    name: "E-mail marketing",
    path: "/email-marketing-para-ecommerce",
    title: "E-mail marketing para e-commerce",
    description:
      "E-mail marketing para lojas virtuais: fluxos de carrinho, boas-vindas e recompra, campanhas segmentadas e base saudável para chegar à caixa de entrada.",
    nav: "E-mail marketing",
    summary: "Fluxos automáticos e campanhas que trazem o cliente de volta",
    intro:
      "A base de clientes é um canal que a loja já pagou para construir. Nosso time monta os fluxos automáticos, planeja as campanhas e cuida da reputação de envio para que os e-mails cheguem e sejam abertos.",
    audiences: [
      { title: "Lojas que só mandam promoção", text: "Disparo igual para todo mundo cansa a base e piora a entrega. Segmentação e fluxos mudam isso." },
      { title: "Marcas com recompra natural", text: "Produtos de consumo recorrente pedem lembretes no momento certo." },
      { title: "Operações sem automação", text: "Carrinho abandonado e boas-vindas são fluxos básicos que muitas lojas ainda não têm." },
    ],
    includes: [
      { title: "Fluxos automáticos", text: "Boas-vindas, carrinho e navegação abandonados, pós-compra, recompra e reativação." },
      { title: "Campanhas", text: "Calendário de envios com segmentos por comportamento de compra." },
      { title: "Entregabilidade", text: "Configuração de domínio, limpeza de base e acompanhamento de reputação." },
      { title: "Textos e layout", text: "E-mails escritos para a sua marca, legíveis no celular." },
      { title: "Captação", text: "Formulários e ofertas de cadastro que aumentam a base sem atrair só caçador de cupom." },
    ],
    steps: [
      { title: "Diagnóstico da base", text: "Olhamos a ferramenta, os fluxos existentes, a reputação de envio e a segmentação." },
      { title: "Fluxos essenciais", text: "Colocamos no ar primeiro os fluxos que recuperam venda perdida." },
      { title: "Calendário", text: "Planejamos as campanhas do mês com o seu time." },
      { title: "Otimização", text: "Testes de assunto, conteúdo e horário, com leitura da receita por e-mail." },
    ],
    connections: [
      { key: "trafego-pago", text: "E-mail traz de volta o visitante que veio do anúncio sem pagar outro clique." },
      { key: "cro", text: "A página de destino do e-mail também precisa converter." },
    ],
    faq: [
      { q: "Vocês trabalham com qual ferramenta de e-mail?", a: "Com a que a sua loja já usa, quando ela atende. Se não atender, recomendamos uma opção que se integre à sua plataforma." },
      { q: "Posso mandar e-mail para quem comprou e não se cadastrou na newsletter?", a: "Mensagens sobre o pedido, sim. Para e-mails de marketing, seguimos a LGPD e só enviamos para quem consentiu." },
      { q: "E-mail marketing ainda funciona?", a: "Funciona quando é segmentado e chega na caixa de entrada. Disparo genérico para a base inteira é o que deixou de funcionar." },
    ],
  },
  ux: {
    key: "ux",
    name: "UX",
    path: "/ux-para-ecommerce",
    title: "UX para e-commerce: loja fácil de comprar",
    description:
      "UX para lojas virtuais: navegação, busca, filtros, página de produto e checkout pensados para quem compra pelo celular, com pesquisa e protótipos.",
    nav: "UX para e-commerce",
    summary: "Navegação, busca e checkout sem atrito",
    intro:
      "Quem não encontra o produto não compra. Nosso time redesenha a navegação, a busca e o caminho até o pagamento a partir de pesquisa com clientes, com prioridade para o celular.",
    audiences: [
      { title: "Lojas com catálogo difícil de navegar", text: "Menus longos, filtros confusos e busca que não acha nada afastam o cliente." },
      { title: "Marcas que vão redesenhar a loja", text: "Um redesenho guiado por pesquisa evita trocar um problema por outro." },
      { title: "Lojas com venda fraca no celular", text: "Quando o celular traz a maior parte das visitas e a menor parte das vendas, a experiência móvel é o gargalo." },
    ],
    includes: [
      { title: "Pesquisa com usuários", text: "Testes de usabilidade e entrevistas curtas com clientes reais." },
      { title: "Arquitetura de informação", text: "Organização de categorias, menu e filtros a partir de como o cliente procura." },
      { title: "Busca interna", text: "Sinônimos, correção de termos e resultados relevantes." },
      { title: "Protótipos", text: "Telas de produto, carrinho e checkout prototipadas e validadas antes de desenvolver." },
      { title: "Acessibilidade", text: "Contraste, tamanho de toque e navegação por teclado para atender todos os clientes." },
    ],
    steps: [
      { title: "Pesquisa", text: "Entendemos como o seu cliente procura e decide." },
      { title: "Mapa de problemas", text: "Listamos os atritos encontrados, do mais grave ao mais leve." },
      { title: "Protótipos", text: "Desenhamos e testamos as soluções com usuários." },
      { title: "Entrega para o desenvolvimento", text: "Especificamos as telas e acompanhamos a implementação." },
    ],
    connections: [
      { key: "cro", text: "Depois do redesenho, o CRO mede e ajusta o efeito em vendas." },
      { key: "seo", text: "Categorias bem organizadas também ajudam a loja a ser encontrada na busca." },
    ],
    faq: [
      { q: "Vocês desenvolvem a loja?", a: "Não. Entregamos pesquisa, protótipos e especificação para o seu time ou a sua agência de desenvolvimento, e acompanhamos a implementação." },
      { q: "Preciso trocar de plataforma?", a: "Raramente. A maioria dos problemas de experiência se resolve dentro da plataforma atual." },
      { q: "Quanto tempo leva um projeto de UX?", a: "Depende do escopo. Uma frente específica, como checkout, é bem mais curta que um redesenho da loja inteira. Definimos o prazo no diagnóstico." },
    ],
  },
  "social-media": {
    key: "social-media",
    name: "Social media",
    path: "/social-media-para-marcas",
    title: "Social media para marcas que vendem online",
    description:
      "Social media para marcas e e-commerces: estratégia, calendário, conteúdo e atendimento no Instagram e em outras redes, ligados ao que a loja precisa vender.",
    nav: "Social media",
    summary: "Conteúdo e calendário ligados às vendas",
    intro:
      "Rede social de marca que vende online precisa conversar com o catálogo, os lançamentos e as campanhas. Nosso time planeja e produz o conteúdo junto com o calendário comercial da loja.",
    audiences: [
      { title: "Marcas que postam sem plano", text: "Post solto não constrói marca nem ajuda a vender. Um calendário ligado às campanhas resolve." },
      { title: "Lojas que lançam produto com frequência", text: "Cada lançamento precisa de conteúdo antes, durante e depois." },
      { title: "Marcas que querem conteúdo para anúncios", text: "Conteúdo orgânico bem feito vira matéria-prima para os criativos de mídia paga." },
    ],
    includes: [
      { title: "Estratégia e linha editorial", text: "Temas, formatos e tom de voz definidos a partir da marca e do público." },
      { title: "Calendário", text: "Planejamento mensal alinhado a lançamentos, datas comerciais e campanhas." },
      { title: "Produção de conteúdo", text: "Textos, roteiros de vídeo curto e direção das peças." },
      { title: "Comunidade", text: "Respostas a comentários e mensagens dentro de um fluxo combinado com o seu atendimento." },
      { title: "Relatório", text: "Alcance, engajamento e cliques para a loja, com os ajustes do mês seguinte." },
    ],
    steps: [
      { title: "Imersão", text: "Conhecemos a marca, o público, os produtos e o histórico das redes." },
      { title: "Linha editorial", text: "Definimos o que publicar, com que frequência e em que tom." },
      { title: "Produção mensal", text: "Calendário aprovado com você antes de cada mês começar." },
      { title: "Análise", text: "Leitura dos resultados e ajuste do plano." },
    ],
    connections: [
      { key: "trafego-pago", text: "Os conteúdos que vão bem no orgânico ganham verba e viram anúncio." },
      { key: "email-marketing", text: "Lançamentos e campanhas saem coordenados nas redes e no e-mail." },
    ],
    faq: [
      { q: "Vocês fazem fotos e vídeos?", a: "Fazemos roteiro e direção. A produção de imagem pode ser feita pelo seu time ou por fornecedores de produção indicados no plano." },
      { q: "Quais redes vocês atendem?", a: "Instagram, Facebook, TikTok, LinkedIn e Pinterest, escolhidas conforme o público da marca." },
      { q: "Social media vende?", a: "Ajuda a vender quando está ligada ao catálogo, às campanhas e à mídia paga. Sozinha, constrói marca e relacionamento." },
    ],
  },
  assessoria: {
    key: "assessoria",
    name: "Assessoria",
    path: "/assessoria-de-marketing-digital",
    title: "Assessoria de marketing digital para e-commerce",
    description:
      "Assessoria de marketing digital para marcas e e-commerces: plano de canais, prioridades, indicadores e acompanhamento do seu time interno.",
    nav: "Assessoria de marketing",
    summary: "Plano, prioridades e acompanhamento do seu time",
    intro:
      "Nem toda empresa precisa terceirizar a execução. Na assessoria, nosso time ajuda a decidir em que canais investir, monta o plano e acompanha o seu time interno até os resultados aparecerem.",
    audiences: [
      { title: "Empresas com time interno", text: "Quem já tem pessoas executando e precisa de direção, prioridade e cobrança de indicadores." },
      { title: "Marcas que vão estruturar o digital", text: "Antes de contratar ferramentas e fornecedores, vale ter um plano." },
      { title: "Gestores que querem um olhar externo", text: "Uma segunda opinião sobre canais, verbas e fornecedores atuais." },
    ],
    includes: [
      { title: "Diagnóstico de canais", text: "Situação de loja, mídia, SEO, e-mail, redes e marketplaces." },
      { title: "Plano de marketing", text: "Objetivos, canais, verba e cronograma priorizados por impacto." },
      { title: "Indicadores", text: "Painel com os números que importam para a diretoria e para o time." },
      { title: "Reuniões de acompanhamento", text: "Encontros periódicos para revisar resultados e decidir os próximos passos." },
      { title: "Apoio na contratação", text: "Ajuda para escolher ferramentas, fornecedores e perfis para o time." },
    ],
    steps: [
      { title: "Diagnóstico", text: "Entendemos o negócio, os números e os canais atuais." },
      { title: "Plano", text: "Apresentamos o plano priorizado e combinamos responsáveis." },
      { title: "Acompanhamento", text: "Reuniões periódicas, revisão de indicadores e correção de rota." },
    ],
    connections: [
      { key: "amazon", text: "Quando a Amazon entra no plano, o módulo Amazon executa a operação." },
      { key: "trafego-pago", text: "Se o time interno não der conta da mídia, a operação pode passar para o nosso time." },
      { key: "seo", text: "O plano define se o orgânico é prioridade e em que páginas começar." },
    ],
    faq: [
      { q: "Qual a diferença entre assessoria e gestão completa?", a: "Na assessoria, o seu time executa e nós orientamos e acompanhamos. Na gestão, o nosso time executa os canais contratados." },
      { q: "Com que frequência são as reuniões?", a: "A frequência é combinada no início, conforme o ritmo do seu time e o momento da empresa." },
      { q: "Posso começar pela assessoria e depois contratar execução?", a: "Sim. Você pode começar pelo plano e depois passar canais específicos para o nosso time." },
    ],
  },
};

export const AMAZON_SERVICE: ServiceSummary = {
  key: "amazon",
  name: "Amazon",
  path: "/consultoria-amazon-para-marcas",
  summary: "Catálogo, anúncios, Ads e margem por SKU na Amazon",
};

// Os 8 serviços na ordem de exibição (grade da home, formulário, JSON-LD).
export const SERVICE_LIST: ServiceSummary[] = [
  AMAZON_SERVICE,
  ...Object.values(SERVICES).map(({ key, name, path, summary }) => ({ key, name, path, summary })),
];

export function isServiceKey(value: string): value is ServiceKey {
  return SERVICE_LIST.some((service) => service.key === value);
}

// ?servico=<chave> na URL do contato; qualquer outra coisa é ignorada.
export function parseServiceParam(value: string | string[] | undefined): ServiceKey | undefined {
  return typeof value === "string" && isServiceKey(value) ? value : undefined;
}

export function serviceSummary(key: ServiceKey): ServiceSummary {
  return SERVICE_LIST.find((service) => service.key === key)!;
}

export function contactHref(key: ServiceKey): string {
  return `/contato?servico=${key}`;
}
