import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { siteConfig } from "@/site.config";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { ContactForm } from "../_components/contact-form";

const page = PAGES.contato;
export const metadata = pageMetadata(page);

export default function ContatoPage() {
  return (
    <main id="conteudo" className="mx-auto max-w-3xl px-4 pt-10">
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: page.title, path: page.path }]} />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">Fale com a Zemann</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">
        Para implantação ou gestão contínua da sua operação na Amazon, conte o seu cenário abaixo. Se preferir,
        escreva para{" "}
        <a href={`mailto:${siteConfig.email}`} className="font-medium text-accent underline">{siteConfig.email}</a>.
      </p>
      <div className="mt-10">
        <ContactForm form="contato" submitLabel="Enviar mensagem" />
      </div>
    </main>
  );
}
