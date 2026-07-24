import type { CategoryTreeNode } from "@mypet/core/catalog-utils";

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function canDeleteCategory(
  categoryId: string,
  categories: { id: string; parentId: string | null }[],
  productCountByCategory: Map<string, number>,
): { allowed: boolean; reason?: string } {
  const hasChildren = categories.some((c) => c.parentId === categoryId);
  if (hasChildren) {
    return { allowed: false, reason: "Categoria tem subcategorias vinculadas." };
  }
  const productCount = productCountByCategory.get(categoryId) ?? 0;
  if (productCount > 0) {
    return { allowed: false, reason: `Categoria tem ${productCount} produto(s) vinculado(s).` };
  }
  return { allowed: true };
}

export function flattenForSelect(
  tree: CategoryTreeNode[],
  depth = 0,
): { id: string; label: string }[] {
  const prefix = depth === 0 ? "" : "— ".repeat(depth);
  return tree.flatMap((node) => [
    { id: node.id, label: `${prefix}${node.name}` },
    ...flattenForSelect(node.children, depth + 1),
  ]);
}

export function isDuplicateSlugError(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}
