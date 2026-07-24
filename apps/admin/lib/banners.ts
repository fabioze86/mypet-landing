export type ExistingBanner = {
  id: string;
  type: "principal" | "mini" | "categoria";
  channel: string;
  category_id: string | null;
  active: boolean;
};

export type CandidateBanner = {
  id?: string;
  type: "principal" | "mini" | "categoria";
  channel: string;
  category_id: string | null;
};

export function findConflictingCategoryBanner(
  existing: ExistingBanner[],
  candidate: CandidateBanner,
): { id: string } | null {
  if (candidate.type !== "categoria") return null;

  const conflict = existing.find(
    (b) =>
      b.id !== candidate.id &&
      b.type === "categoria" &&
      b.channel === candidate.channel &&
      b.category_id === candidate.category_id &&
      b.active,
  );

  return conflict ? { id: conflict.id } : null;
}
