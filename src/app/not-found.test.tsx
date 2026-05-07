import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("NotFound boundary", () => {
  it("renders branded 404 with quick links to home and groups", () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html).toContain("Page not found");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/groups"');
    expect(html).toContain('href="/search"');
  });
});
