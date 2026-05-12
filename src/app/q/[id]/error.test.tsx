import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import QuestionError from "./error";

describe("Question segment error boundary", () => {
  it("renders the segment-specific error UI with a retry button", () => {
    const reset = vi.fn();
    const html = renderToStaticMarkup(<QuestionError error={new Error("db down")} reset={reset} />);
    expect(html).toContain("Couldn&#x27;t load this question");
    expect(html).toContain("Try again");
  });
});
