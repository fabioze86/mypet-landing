// O que o cadastro libera: o visitante vê o que ganha antes de informar CNPJ
// e WhatsApp.
export const CADASTRO_UNLOCKS = [
  {
    title: "Tabela de preços completa",
    body: "Todos os itens com os mesmos preços do mypetbrasil.com, com busca por nome, SKU, categoria ou marca.",
  },
  { title: "Catálogo com preços", body: "Fotos e preços de cada categoria, para consultar quando quiser." },
  { title: "Agente My Pet completo", body: "Encontra produtos, mostra os preços e monta o pedido com você." },
  { title: "Pedido pelo WhatsApp", body: "Monte o pedido na tabela ou no agente e envie pronto para o nosso time." },
] as const;

export function CadastroUnlocks() {
  return (
    <section className="hub-unlocks" aria-labelledby="hub-unlocks-title">
      <h2 id="hub-unlocks-title">O que o cadastro libera</h2>
      <ul>
        {CADASTRO_UNLOCKS.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            <span>{item.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
