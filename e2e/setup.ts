import { test as base, expect } from "@playwright/test";

/**
 * Strip the Next.js dev error overlay before tests run. The overlay is a
 * <dialog> that intercepts pointer events, so any dev-only console error
 * blocks the whole test. This is a knowingly broad workaround: it also hides
 * legitimate runtime errors. The remaining trigger today is Base UI's
 * `nativeButton` invariant warning emitted by `<Button render={<Link/>}>`
 * callsites (every "Sign in", "Create group", pagination, etc.). Removing
 * this workaround requires either marking those callsites with
 * `nativeButton={false}` (which changes their accessibility role from
 * link→button — a deliberate UX call, not a test concern) or introducing a
 * `<ButtonLink>` component that doesn't go through Base UI's Button.
 */
const HIDE_DEV_OVERLAY = `
  (() => {
    const remove = () => {
      for (const el of document.querySelectorAll('nextjs-portal')) {
        el.remove();
      }
    };
    remove();
    const obs = new MutationObserver(remove);
    const start = () => obs.observe(document.documentElement, { childList: true, subtree: true });
    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
  })();
`;

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(HIDE_DEV_OVERLAY);
    // eslint-disable-next-line react-hooks/rules-of-hooks -- `use` is the Playwright fixture callback, not a React hook
    await use(context);
  },
});

export { expect };
