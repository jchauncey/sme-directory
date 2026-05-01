export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MAX_LENGTH = 64;

const COMBINING_MARKS = /[̀-ͯ]/g;

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}

export function isValidSlug(s: string): boolean {
  return s.length >= 2 && s.length <= SLUG_MAX_LENGTH && SLUG_RE.test(s);
}
