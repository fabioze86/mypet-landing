import { cacheLife, cacheTag } from "next/cache";
import { getHubClient } from "./supabase";
import { escapeOrFilterValue } from "./catalog-line-items";

export type CategoriaAjuda = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  icone: string;
  ordem: number;
};

export type ArtigoAjudaResumo = {
  id: string;
  categoriaId: string;
  slug: string;
  titulo: string;
  resumo: string;
  ordem: number;
};

export type ArtigoAjuda = ArtigoAjudaResumo & {
  corpoMarkdown: string;
};

type RawCategoria = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string;
  icone: string;
  ordem: number;
};

type RawArtigoResumo = {
  id: string;
  categoria_id: string;
  slug: string;
  titulo: string;
  resumo: string;
  ordem: number;
};

type RawArtigo = RawArtigoResumo & { corpo_markdown: string };

function mapCategoria(row: RawCategoria): CategoriaAjuda {
  return {
    id: row.id,
    slug: row.slug,
    titulo: row.titulo,
    descricao: row.descricao,
    icone: row.icone,
    ordem: row.ordem,
  };
}

function mapArtigoResumo(row: RawArtigoResumo): ArtigoAjudaResumo {
  return {
    id: row.id,
    categoriaId: row.categoria_id,
    slug: row.slug,
    titulo: row.titulo,
    resumo: row.resumo,
    ordem: row.ordem,
  };
}

function mapArtigo(row: RawArtigo): ArtigoAjuda {
  return { ...mapArtigoResumo(row), corpoMarkdown: row.corpo_markdown };
}

const ARTIGO_RESUMO_SELECT = "id, categoria_id, slug, titulo, resumo, ordem";
const ARTIGO_SELECT = `${ARTIGO_RESUMO_SELECT}, corpo_markdown`;

export async function getCategoriasAjuda(): Promise<CategoriaAjuda[]> {
  "use cache";
  cacheLife("days");
  cacheTag("central-ajuda");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("categorias_ajuda")
    .select("id, slug, titulo, descricao, icone, ordem")
    .order("ordem", { ascending: true });

  if (error) {
    console.error("[help-center] erro ao listar categorias:", error.message);
    return [];
  }
  return ((data as RawCategoria[] | null) ?? []).map(mapCategoria);
}

export async function getCategoriaAjudaBySlug(slug: string): Promise<CategoriaAjuda | null> {
  "use cache";
  cacheLife("days");
  cacheTag("central-ajuda");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("categorias_ajuda")
    .select("id, slug, titulo, descricao, icone, ordem")
    .eq("slug", slug);

  if (error) {
    console.error("[help-center] erro ao buscar categoria:", error.message);
    return null;
  }
  const row = (data as RawCategoria[] | null)?.[0];
  return row ? mapCategoria(row) : null;
}

export async function getArtigosAjudaPublicadosPorCategoria(
  categoriaId: string,
): Promise<ArtigoAjudaResumo[]> {
  "use cache";
  cacheLife("days");
  cacheTag("central-ajuda");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("artigos_ajuda")
    .select(ARTIGO_RESUMO_SELECT)
    .eq("categoria_id", categoriaId)
    .eq("status", "publicado")
    .order("ordem", { ascending: true });

  if (error) {
    console.error("[help-center] erro ao listar artigos:", error.message);
    return [];
  }
  return ((data as RawArtigoResumo[] | null) ?? []).map(mapArtigoResumo);
}

export async function getArtigoAjudaPublicadoBySlug(slug: string): Promise<ArtigoAjuda | null> {
  "use cache";
  cacheLife("days");
  cacheTag("central-ajuda");

  const supabase = getHubClient();
  const { data, error } = await supabase
    .from("artigos_ajuda")
    .select(ARTIGO_SELECT)
    .eq("slug", slug)
    .eq("status", "publicado");

  if (error) {
    console.error("[help-center] erro ao buscar artigo:", error.message);
    return null;
  }
  const row = (data as RawArtigo[] | null)?.[0];
  return row ? mapArtigo(row) : null;
}

/**
 * Busca dinâmica — sem "use cache": cada termo geraria uma entrada de cache
 * própria, e o valor de cachear buscas raras não compensa isso.
 */
export async function buscarArtigosAjudaPublicados(termo: string): Promise<ArtigoAjudaResumo[]> {
  const supabase = getHubClient();
  const seguro = escapeOrFilterValue(termo);
  const { data, error } = await supabase
    .from("artigos_ajuda")
    .select(ARTIGO_RESUMO_SELECT)
    .eq("status", "publicado")
    .or(`titulo.ilike.%${seguro}%,resumo.ilike.%${seguro}%,palavras_chave.ilike.%${seguro}%`)
    .order("ordem", { ascending: true });

  if (error) {
    console.error("[help-center] erro ao buscar artigos:", error.message);
    return [];
  }
  return ((data as RawArtigoResumo[] | null) ?? []).map(mapArtigoResumo);
}
