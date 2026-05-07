import { useEffect, type RefObject } from "react";

export type FieldError = { path: string; message: string };

/**
 * Focus the first invalid field after a submit error.
 *
 * Why: server-action forms render error text inline but never move focus, so
 * keyboard/screen-reader users have to hunt for the failing field. This watches
 * `fieldErrors` and sends focus to the first matching `[name=...]` inside the form.
 */
export function findFirstErrorField(
  form: HTMLFormElement | ParentNode,
  fieldErrors: readonly FieldError[] | undefined,
): HTMLElement | null {
  if (!fieldErrors || fieldErrors.length === 0) return null;
  for (const err of fieldErrors) {
    const el = form.querySelector<HTMLElement>(`[name="${CSS.escape(err.path)}"]`);
    if (el) return el;
  }
  return null;
}

export function useFocusFirstError(
  formRef: RefObject<HTMLFormElement | null>,
  fieldErrors: readonly FieldError[] | undefined,
): void {
  useEffect(() => {
    if (!fieldErrors || fieldErrors.length === 0) return;
    const form = formRef.current;
    if (!form) return;
    const el = findFirstErrorField(form, fieldErrors);
    if (el && typeof el.focus === "function") el.focus();
  }, [fieldErrors, formRef]);
}

/**
 * Warn before navigating away with unsaved form changes.
 *
 * Covers tab close, browser back/forward, and external navigation via the
 * `beforeunload` event. In-app Next.js navigation is not reliably interceptable,
 * so this only protects against hard navigation — which is where users
 * actually lose unsaved long-form content.
 */
export function useUnsavedChangesWarning(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
