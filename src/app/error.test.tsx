import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RootError from "./error";

describe("RootError boundary", () => {
  it("renders the branded error UI with a retry button", () => {
    const reset = vi.fn();
    const html = renderToStaticMarkup(
      <RootError error={Object.assign(new Error("boom"), { digest: "abc123" })} reset={reset} />,
    );
    expect(html).toContain("Something went wrong");
    expect(html).toContain("Try again");
    expect(html).toContain("abc123");
  });

  it("omits the digest reference when none is provided", () => {
    const html = renderToStaticMarkup(<RootError error={new Error("boom")} reset={() => {}} />);
    expect(html).toContain("Try again");
    expect(html).not.toContain("Reference:");
  });
});
