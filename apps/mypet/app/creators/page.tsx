import type { Metadata } from "next";
import { CheckCircle, ArrowSquareOut, ImageSquare } from "@phosphor-icons/react/dist/ssr";
import { canonicalUrl } from "@mypet/core/seo";
import { clientConfig } from "@/client.config";
import { popFontVariables } from "../_components/pop/fonts";
import { POP_STYLES } from "../_components/pop/styles";
import { displayName } from "../_components/pop/text";
import { CopyButton } from "../_components/pop/copy-button";
import { getCatDogLines } from "./catdog-data";
import { FAQ, GOOD_PRACTICES, MARKETPLACES, SCRIPTS } from "./creators-content";
import { CREATORS_STYLES } from "./styles";

const { name: SITE_NAME, logo } = clientConfig;

export function generateMetadata(): Metadata {
  return {
    title: `Cat Dog para creators e afiliados - ${SITE_NAME}`,
    description:
      "Divulgue a Cat Dog, marca própria da My Pet, como afiliado do Mercado Livre e da Shopee. Produtos, fotos oficiais, roteiros e legendas prontos.",
    alternates: { canonical: canonicalUrl(clientConfig.domain, "/creators") },
  };
}

export default async function CreatorsPage() {
  const lines = await getCatDogLines(clientConfig.catalogChannel);
  const total = lines.reduce((n, line) => n + line.products.length, 0);
  const collage = lines.slice(0, 3).map((line) => line.products[0]);
  const brandLinks = MARKETPLACES.filter((m) => m.brandUrl);

  return (
    <div className={`cp ${popFontVariables}`}>
      <style>{POP_STYLES}</style>
      <style>{CREATORS_STYLES}</style>

      <header className="cp-header">
        <div className="cp-wrap cp-header-row">
          <span className="cp-brand">
            <span aria-hidden>{logo.emoji}</span>
            <span>Cat Dog · My Pet</span>
          </span>
          <a href="#como-ganhar" className="cp-btn cp-btn-primary">Gerar meu link</a>
        </div>
      </header>

      <main>
        <section className="cp-hero" aria-labelledby="cr-hero-title">
          <div className="cp-wrap cp-hero-grid">
            <div className="cp-hero-copy">
              <span className="cp-kicker">Para creators e afiliados</span>
              <h1 id="cr-hero-title">
                Divulgue Cat Dog e <em>ganhe por venda</em>
              </h1>
              <p className="cp-lead">
                Cat Dog é a marca própria da My Pet: banho, higiene e cuidados para cães e gatos.
                Escolha os produtos, gere seu link de afiliado no Mercado Livre ou na Shopee e use
                as fotos e os roteiros desta página.
              </p>
              <div className="cp-hero-actions">
                <a href="#como-ganhar" className="cp-btn cp-btn-primary">Como gerar o link</a>
                <a href="#produtos" className="cp-btn cp-btn-ghost">Ver produtos</a>
              </div>
              <ul className="cp-trust">
                <li><CheckCircle size={18} weight="fill" aria-hidden /> Sem cadastro com a gente</li>
                <li><CheckCircle size={18} weight="fill" aria-hidden /> Comissão paga pelo marketplace</li>
                <li><CheckCircle size={18} weight="fill" aria-hidden /> Fotos e roteiros liberados</li>
              </ul>
            </div>
            {collage.length === 3 ? (
              <div className="cr-collage" aria-hidden>
                {collage.map((p) => (
                  <span key={p.id}><img src={p.img} alt="" decoding="async" /></span>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <div className="cp-strip" aria-hidden>
          <ul>
            <li>Mercado Livre</li>
            <li>Shopee</li>
            {total > 0 ? <li>{total} produtos Cat Dog</li> : null}
            <li>Roteiros prontos</li>
          </ul>
        </div>

        <section id="como-ganhar" className="cp-sec" aria-labelledby="cr-ganhar-title">
          <div className="cp-wrap">
            <div className="cp-sec-head">
              <h2 id="cr-ganhar-title" className="cp-h2 cp-h2--laranja">Como ganhar em 4 passos</h2>
              <p className="cp-lead">
                Tudo acontece no programa de afiliados do marketplace: é lá que você gera o link,
                acompanha as vendas e recebe a comissão.
              </p>
            </div>
            <div className="cr-markets">
              {MARKETPLACES.map((m) => (
                <div className={`cr-market cr-market--${m.id}`} key={m.id}>
                  <h3>{m.name}</h3>
                  <ol>
                    {m.steps.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                  <div className="cr-market-actions">
                    <a href={m.programUrl} target="_blank" rel="noopener noreferrer" className="cp-btn cp-btn-primary">
                      Entrar no programa <ArrowSquareOut size={18} weight="bold" aria-hidden />
                    </a>
                    {m.brandUrl ? (
                      <a href={m.brandUrl} target="_blank" rel="noopener noreferrer" className="cp-btn cp-btn-ghost">
                        Ver Cat Dog no {m.name}
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <p className="cr-note">
              A comissão é definida por cada marketplace, conforme a categoria e as campanhas do
              momento. O valor atualizado aparece no seu painel de afiliado.
            </p>
          </div>
        </section>

        {lines.length > 0 ? (
          <section id="produtos" className="cp-sec" aria-labelledby="cr-produtos-title" style={{ paddingTop: 0 }}>
            <div className="cp-wrap">
              <div className="cp-sec-head">
                <h2 id="cr-produtos-title" className="cp-h2">O portfólio Cat Dog</h2>
                <p className="cp-lead">
                  Ache o produto aqui e busque pelo nome na página da Cat Dog do marketplace. As fotos
                  são oficiais e liberadas para os seus posts.
                </p>
                {brandLinks.length > 0 ? (
                  <div className="cp-hero-actions">
                    {brandLinks.map((m) => (
                      <a key={m.id} href={m.brandUrl} target="_blank" rel="noopener noreferrer" className="cp-btn cp-btn-ghost">
                        Cat Dog no {m.name}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>

              <nav className="cr-chips" aria-label="Linhas Cat Dog">
                {lines.map((line) => (
                  <a key={line.id} href={`#linha-${line.id}`}>{line.title}</a>
                ))}
              </nav>

              {lines.map((line) => (
                <div key={line.id} id={`linha-${line.id}`} className="cr-line">
                  <h3>{line.title}</h3>
                  <p>{line.pitch}</p>
                  <ul className="cr-grid">
                    {line.products.map((p) => {
                      const name = displayName(p.name);
                      return (
                        <li key={p.id} className="cr-card">
                          <span className="cr-card-media"><img src={p.img} alt={name} loading="lazy" decoding="async" /></span>
                          <span className="cr-card-name">{name}</span>
                          <span className="cr-card-actions">
                            <CopyButton text={name} label="Copiar nome" className="cr-mini" />
                            <a href={p.img} target="_blank" rel="noopener noreferrer" className="cr-mini" aria-label={`Abrir foto de ${name}`}>
                              <ImageSquare size={15} weight="bold" aria-hidden /> Foto
                            </a>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section id="roteiros" className="cp-sec cr-scripts-sec" aria-labelledby="cr-roteiros-title">
          <div className="cp-wrap">
            <div className="cp-sec-head">
              <h2 id="cr-roteiros-title" className="cp-h2 cp-h2--laranja">Roteiros prontos</h2>
              <p className="cp-lead">Gancho, roteiro e legenda para Reels, TikTok e Stories. Copie e adapte ao seu jeito.</p>
            </div>
            <div className="cr-scripts">
              {SCRIPTS.map((s) => (
                <article key={s.id} className="cr-script" aria-labelledby={`cr-s-${s.id}`}>
                  <span className="cp-card-group">{s.theme}</span>
                  <h3 id={`cr-s-${s.id}`}>&ldquo;{s.hook}&rdquo;</h3>
                  <small>{s.products}</small>
                  <ol>
                    {s.script.map((step) => <li key={step}>{step}</li>)}
                  </ol>
                  <p className="cr-caption">{s.caption}</p>
                  <span className="cr-card-actions">
                    <CopyButton text={s.hook} label="Copiar gancho" className="cr-mini" />
                    <CopyButton text={s.caption} label="Copiar legenda" className="cr-mini" />
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="cp-sec" aria-labelledby="cr-regras-title">
          <div className="cp-wrap">
            <div className="cp-sec-head">
              <h2 id="cr-regras-title" className="cp-h2">Combinados rápidos</h2>
            </div>
            <div className="cp-why">
              {GOOD_PRACTICES.map((g) => (
                <div className="cp-box" key={g.title}>
                  <h3>{g.title}</h3>
                  <p>{g.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="cp-sec" aria-labelledby="cr-faq-title" style={{ paddingTop: 0 }}>
          <div className="cp-wrap">
            <div className="cp-sec-head">
              <h2 id="cr-faq-title" className="cp-h2 cp-h2--laranja">Dúvidas</h2>
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
          © {SITE_NAME}. Cat Dog é marca própria da My Pet Brasil. Comissões pagas pelos programas de
          afiliados do Mercado Livre e da Shopee, nas regras de cada um.
        </div>
      </footer>

      <div className="cp-sticky">
        <a href="#como-ganhar" className="cp-btn cp-btn-primary">Gerar meu link</a>
      </div>
    </div>
  );
}
