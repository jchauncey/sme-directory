export function logServerError(scope: string, err: unknown): void {
  console.error(`[${scope}]`, err);
}
