export function getInitials(...sources: Array<string | null | undefined>): string {
  for (const source of sources) {
    if (!source) continue;
    const trimmed = source.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  return "?";
}
