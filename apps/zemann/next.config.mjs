import createMDX from "@next/mdx";

/** @type {import('next').NextConfig} */
const nextConfig = {};

// Plugins como string: exigência do Turbopack (ver guia MDX do Next).
// remark-frontmatter tira o bloco YAML do HTML; o frontmatter é lido à parte
// por lib/content.ts com gray-matter. remark-gfm habilita tabelas.
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-frontmatter", "remark-gfm"],
  },
});

export default withMDX(nextConfig);
