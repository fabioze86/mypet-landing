import "dotenv/config";
import { readFileSync } from "node:fs";
import { getHubServiceClient } from "@mypet/core/supabase";

const CHANNEL = "azpetshop";

/**
 * Lê um CSV `reference,price` (cabeçalho obrigatório) e devolve as linhas válidas.
 *
 * Regras:
 * - separador de campo: `;` se o cabeçalho contiver `;`, senão `,`;
 * - com separador `;`, o ponto é tratado como separador de milhar (removido) e a
 *   vírgula como separador decimal — ex.: `1.199,90` -> `1199.9`;
 * - com separador `,`, a vírgula decimal também é aceita — ex.: `199,90` -> `199.9`;
 * - descarta linhas sem referência, com preço não numérico ou com preço <= 0
 *   (a coluna `sale_price` tem CHECK `sale_price > 0`).
 */
export function parsePrecosCsv(text: string): { reference: string; price: number }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [];

  const sep = lines[0].includes(";") ? ";" : ",";
  const out: { reference: string; price: number }[] = [];

  for (const line of lines.slice(1)) {
    const [rawRef, rawPrice] = line.split(sep);
    const reference = (rawRef ?? "").trim();
    const price = Number(
      (rawPrice ?? "")
        .trim()
        .replace(/\./g, sep === ";" ? "" : ".")
        .replace(",", "."),
    );
    if (!reference || !Number.isFinite(price) || price <= 0) continue;
    out.push({ reference, price });
  }

  return out;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("uso: pnpm azpetshop:import-precos <caminho-do-csv>");
    process.exit(1);
  }

  const rows = parsePrecosCsv(readFileSync(csvPath, "utf8"));
  console.log(`${rows.length} linhas válidas lidas de ${csvPath}`);

  const supabase = getHubServiceClient();
  let ok = 0;
  let semProduto = 0;
  let ambiguas = 0;
  let erros = 0;

  for (const row of rows) {
    const { data: matches, error: lookupError } = await supabase
      .from("products")
      .select("id")
      .eq("reference", row.reference);

    if (lookupError) {
      erros++;
      console.error(`- erro ao buscar ${row.reference}: ${lookupError.message}`);
      continue;
    }

    if (!matches || matches.length === 0) {
      semProduto++;
      console.warn(`- referência sem produto: ${row.reference}`);
      continue;
    }

    if (matches.length > 1) {
      ambiguas++;
      console.warn(
        `- referência ambígua (${matches.length} produtos), usando o primeiro: ${row.reference}`,
      );
    }

    const productId = matches[0].id;

    const { error } = await supabase.from("product_channel_prices").upsert(
      {
        product_id: productId,
        channel: CHANNEL,
        sale_price: row.price,
        sale_updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id,channel" },
    );
    if (error) {
      erros++;
      console.error(`- erro em ${row.reference}: ${error.message}`);
      continue;
    }
    ok++;
  }

  console.log(
    `concluído: ${ok} preços gravados, ${semProduto} referências sem produto, ` +
      `${ambiguas} referências ambíguas, ${erros} erros.`,
  );
}

if (process.argv[1]?.endsWith("azpetshop-import-precos.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
