import { PAGES } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { parseServiceParam } from "@/lib/services";
import { siteConfig } from "@/site.config";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { ContactForm } from "../_components/contact-form";

const page = PAGES.contato;
export const metadata = pageMetadata(page);

export default async function ContatoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // ?servico=<chave> vem do CTA das páginas de serviço; chave desconhecida é ignorada.
  const defaultService = parseServiceParam((await searchParams).servico);
  return (
    <main id="conteudo" className="mx-auto max-w-3xl px-4 pt-10">
      <Breadcrumbs items={[{ name: "Início", path: "/" }, { name: page.title, path: page.path }]} />
      <h1 className="mt-6 text-4xl font-extrabold text-ink">Fale com o nosso time</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-soft">
        Conte o seu cenário e, se já souber, o serviço que procura: Amazon, SEO, tráfego pago, CRO, e-mail
        marketing, UX, social media ou assessoria. Se preferir, escreva para{" "}
        <a href={`mailto:${siteConfig.email}`} className="font-medium text-accent underline">{siteConfig.email}</a>.
      </p>
      <div className="mt-10">
        <ContactForm form="contato" submitLabel="Enviar mensagem" withService defaultService={defaultService} />
      </div>
    </main>
  );
}
