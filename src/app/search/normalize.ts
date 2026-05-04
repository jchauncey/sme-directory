export type NormalizedScope = "all" | "current" | "selected";

export type Normalized = {
  scope: NormalizedScope;
  groupIds: string[];
  groupSlugForUrl: string | null;
};

/**
 * Apply the group-context default: when /search is entered with `groupSlug` and
 * the user hasn't picked a different scope, scope to that group. Once the user
 * sets `scope` or `groupIds` explicitly, those win.
 */
export function applyGroupSlugDefault(
  rawScope: string | undefined,
  rawGroupIds: string | undefined,
  resolvedSlugId: string | null,
  groupSlug: string | undefined,
): Normalized {
  const explicitScope = rawScope === "all" || rawScope === "current" || rawScope === "selected";
  const hasGroupIds = (rawGroupIds ?? "").length > 0;

  if (!explicitScope && !hasGroupIds && resolvedSlugId) {
    return {
      scope: "current",
      groupIds: [resolvedSlugId],
      groupSlugForUrl: groupSlug ?? null,
    };
  }

  const scope: NormalizedScope =
    rawScope === "current" || rawScope === "selected" ? rawScope : "all";
  const groupIds = rawGroupIds
    ? rawGroupIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  return { scope, groupIds, groupSlugForUrl: null };
}
