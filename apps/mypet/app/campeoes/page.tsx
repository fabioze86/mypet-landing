import type { Metadata } from "next";
import {
  CheckCircle,
  Lightning,
  LockKey,
  Package,
  ShieldCheck,
  TrendUp,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { AccessForm } from "../_components/pre-access/access-form";
import { commercialConditions } from "../pre-access-content";
import { displayName, getChampions, type Champion } from "./champions-data";
import { popFontVariables } from "../_components/pop/fonts";
import { POP_STYLES } from "../_components/pop/styles";

// Landing de campanha para tráfego do Instagram (bio, stories e anúncios).
// Objetivo único: o lojista deixar CNPJ + WhatsApp e cair na tabela
// (/pedido-rapido). Mesmas regras da home: nenhum preço de item aqui e nada
// de "atacado", "cotação" ou "loja" na copy.

const { name: SITE_NAME, logo } = clientConfig;
const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "";
const WHATSAPP_TEXT = "Olá! Vim pelo Instagram e quero saber dos campeões de vendas da My Pet.";

export function generateMetadata(): Metadata {
  return {
    title: `Campeões de vendas - ${SITE_NAME}`,
    description:
      "Os produtos que mais giram nos pet shops, com os mesmos preços do mypetbrasil.com. Libere os preços com seu CNPJ e faça o pedido pelo WhatsApp.",
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/campeoes") },
    // Página de campanha: não disputa a busca com a home.
    robots: { index: false, follow: true },
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

function Podium({ top }: { top: Champion[] }) {
  // Ordem visual 2º, 1º, 3º, como num pódio.
  const order = [top[1], top[0], top[2]];
  const ranks = [2, 1, 3];
  return (
    <div className="cp-podium" aria-hidden>
      {order.map((item, i) =>
        item ? (
          <div className="cp-podium-item" key={item.id}>
            <div className="cp-podium-img">
              <img src={item.img} alt="" decoding="async" />
            </div>
            <div className="cp-podium-base">{ranks[i]}º</div>
          </div>
        ) : null,
      )}
    </div>
  );
}

const WHY = [
  {
    icon: TrendUp,
    title: "Giro garantido",
    body: "São os itens que os pet shops mais repõem com a gente. Produto que o cliente já procura no balcão.",
  },
  {
    icon: ShieldCheck,
    title: "Mesmo preço do site",
    body: "Os valores da tabela são os mesmos do mypetbrasil.com, atualizados todos os dias.",
  },
  {
    icon: Package,
    title: "Reposição sem ruptura",
    body: "Estoque próprio e quase 5 mil itens. Você completa o pedido com o que faltar na prateleira.",
  },
  {
    icon: WhatsappLogo,
    title: "Pedido no WhatsApp",
    body: "Monte o pedido na tabela e ele chega pronto para o nosso time, com atendimento de gente.",
  },
] as const;

const FAQ = [
  {
    q: "Preciso de CNPJ?",
    a: "Sim. A tabela é para pet shops, clínicas, banho e tosa e revendas. Com o CNPJ e o WhatsApp o acesso é liberado na hora.",
  },
  {
    q: "Os preços são os mesmos do site?",
    a: "São. A tabela mostra os mesmos produtos e preços do mypetbrasil.com, só que numa tela feita para reposição.",
  },
  {
    q: "Tem pedido mínimo?",
    a: `${commercialConditions[0].detail}`,
  },
  {
    q: "Posso misturar os campeões com outros produtos?",
    a: "Pode. Depois do cadastro você busca qualquer item do catálogo por nome, SKU, marca ou categoria e monta um pedido só.",
  },
] as const;

export default async function ChampionsPage() {
  const champions = await getChampions(clientConfig.catalogChannel);
  const whatsappHref = WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_TEXT)}`
    : null;

  return (
    <div className={`cp ${popFontVariables}`}>
      <style>{POP_STYLES}</style>

      <header className="cp-header">
        <div className="cp-wrap cp-header-row">
          <a href="/" className="cp-brand">
            <span aria-hidden>{logo.emoji}</span>
            <span>{SITE_NAME}</span>
          </a>
          <a href="#liberar" className="cp-btn cp-btn-primary">Ver preços</a>
        </div>
      </header>

      <main>
        <section className="cp-hero" aria-labelledby="cp-hero-title">
          <div className="cp-wrap cp-hero-grid">
            <div className="cp-hero-copy">
              <span className="cp-kicker">Campeões de vendas</span>
              <h1 id="cp-hero-title">
                O que mais sai <em>no seu balcão</em>
              </h1>
              <p className="cp-lead">
                Os produtos que os pet shops mais repõem com a My Pet, com os mesmos preços do
                mypetbrasil.com. Libere a tabela com seu CNPJ e mande o pedido pelo WhatsApp.
              </p>
              <div className="cp-hero-actions">
                <a href="#liberar" className="cp-btn cp-btn-primary">Liberar preços</a>
                <a href="#campeoes" className="cp-btn cp-btn-ghost">Ver os campeões</a>
              </div>
              <ul className="cp-trust">
                <li><CheckCircle size={18} weight="fill" aria-hidden /> Acesso na hora</li>
                <li><CheckCircle size={18} weight="fill" aria-hidden /> Mesmo preço do site</li>
                <li><CheckCircle size={18} weight="fill" aria-hidden /> Pedido pelo WhatsApp</li>
              </ul>
            </div>
            {champions.length >= 3 ? <Podium top={champions.slice(0, 3)} /> : null}
          </div>
        </section>

        <div className="cp-strip" aria-hidden>
          <ul>
            <li>Banho e tosa</li>
            <li>Higiene</li>
            <li>Petiscos</li>
            <li>Gatos</li>
            <li>Acessórios</li>
          </ul>
        </div>

        {champions.length > 0 ? (
          <section id="campeoes" className="cp-sec" aria-labelledby="cp-campeoes-title">
            <div className="cp-wrap">
              <div className="cp-sec-head">
                <h2 id="cp-campeoes-title" className="cp-h2 cp-h2--laranja">Os campeões da My Pet</h2>
                <p className="cp-lead">
                  Ranking dos itens que mais giram. O preço de cada um aparece assim que você libera a tabela.
                </p>
              </div>
              <ul className="cp-grid">
                {champions.map((item, i) => (
                  <li key={item.id}>
                    <a className="cp-card" href="#liberar" aria-label={`${displayName(item.name)}: liberar preço`}>
                      <span className="cp-card-rank">#{pad(i + 1)}</span>
                      <span className="cp-card-media">
                        <img src={item.img} alt="" loading="lazy" decoding="async" />
                      </span>
                      <span className="cp-card-body">
                        <span className="cp-card-group">{item.group}</span>
                        <span className="cp-card-name">{displayName(item.name)}</span>
                        {item.brand ? <span className="cp-card-brand">{item.brand}</span> : null}
                        <span className="cp-card-lock">
                          <LockKey size={16} weight="bold" aria-hidden /> Liberar preço
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <div className="cp-grid-cta">
                <a href="#liberar" className="cp-btn cp-btn-primary">Quero ver os preços</a>
              </div>
            </div>
          </section>
        ) : null}

        <section className="cp-sec" aria-labelledby="cp-why-title" style={{ paddingTop: champions.length ? 0 : undefined }}>
          <div className="cp-wrap">
            <div className="cp-sec-head">
              <h2 id="cp-why-title" className="cp-h2">Por que repor com a My Pet</h2>
            </div>
            <div className="cp-why">
              {WHY.map(({ icon: Icon, title, body: text }) => (
                <div className="cp-box" key={title}>
                  <Icon size={30} weight="duotone" aria-hidden />
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="cp-sec" aria-labelledby="cp-steps-title" style={{ paddingTop: 0 }}>
          <div className="cp-wrap">
            <div className="cp-sec-head">
              <h2 id="cp-steps-title" className="cp-h2 cp-h2--laranja">Em 3 passos</h2>
            </div>
            <ol className="cp-steps">
              <li><b>Informe o CNPJ</b><span>CNPJ e WhatsApp. Leva menos de um minuto.</span></li>
              <li><b>Veja os preços</b><span>A tabela abre na hora, com os campeões e o catálogo inteiro.</span></li>
              <li><b>Mande o pedido</b><span>Informe as quantidades e o pedido chega pronto no nosso WhatsApp.</span></li>
            </ol>
            <div className="cp-conds" style={{ marginTop: 14 }}>
              {commercialConditions.map((c) => (
                <div className="cp-cond" key={c.id}>
                  <small>{c.title}</small>
                  <strong>{c.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="liberar" className="cp-cta-sec" aria-labelledby="cp-form-title">
          <div className="cp-wrap cp-cta-grid">
            <div className="cp-cta-copy">
              <h2>Libere os preços <em>agora</em></h2>
              <p>Cadastro rápido com CNPJ. Você já cai na tabela com todos os campeões e monta o pedido.</p>
              <ul>
                <li><Lightning size={20} weight="fill" aria-hidden /> Acesso liberado na hora</li>
                <li><ShieldCheck size={20} weight="fill" aria-hidden /> Mesmos preços do mypetbrasil.com</li>
                <li><WhatsappLogo size={20} weight="fill" aria-hidden /> Pedido enviado pelo WhatsApp</li>
              </ul>
            </div>
            <div className="cp-form-card">
              <h3 id="cp-form-title">Ver preços dos campeões</h3>
              <p>Use o WhatsApp da empresa: é por ele que o pedido chega.</p>
              <AccessForm submitLabel="Liberar preços" />
              {whatsappHref ? (
                <p className="cp-form-alt">
                  Prefere falar com a gente?{" "}
                  <a href={whatsappHref} target="_blank" rel="noopener noreferrer">Chamar no WhatsApp</a>
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="cp-sec" aria-labelledby="cp-faq-title">
          <div className="cp-wrap">
            <div className="cp-sec-head">
              <h2 id="cp-faq-title" className="cp-h2">Dúvidas rápidas</h2>
            </div>
            <div className="cp-faq">
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="cp-footer">
        <div className="cp-wrap">
          © {SITE_NAME}. Dados de CNPJ e WhatsApp usados apenas para liberar a tabela de preços.{" "}
          <a href="/">Conheça a Tabela de Preços</a>
        </div>
      </footer>

      <div className="cp-sticky">
        <a href="#liberar" className="cp-btn cp-btn-primary">Ver preços dos campeões</a>
      </div>
    </div>
  );
}
