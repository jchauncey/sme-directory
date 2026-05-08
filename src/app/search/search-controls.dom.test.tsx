import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchControls } from "./search-controls";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const baseProps = {
  initialQ: "",
  initialScope: "all" as const,
  initialGroupIds: [],
  myGroups: [
    { id: "g1", slug: "alpha", name: "Alpha" },
    { id: "g2", slug: "beta", name: "Beta" },
  ],
  initialStatus: "all" as const,
  initialRange: "all" as const,
  initialSort: "relevance" as const,
  initialAuthor: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
  replace.mockReset();
});

describe("SearchControls", () => {
  it("disables the My groups scope when the user has no groups", () => {
    render(<SearchControls {...baseProps} myGroups={[]} />);
    const myGroupsButton = screen.getByRole("button", { name: /My groups/i });
    expect(myGroupsButton).toBeDisabled();
    expect(myGroupsButton).toHaveAttribute(
      "title",
      "Join a group to use this scope.",
    );
  });

  it("reveals checkboxes for every group when Pick groups is selected", async () => {
    const user = userEvent.setup();
    render(<SearchControls {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Pick groups" }));

    const checkboxes = await screen.findAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    checkboxes.forEach((cb) => expect(cb).not.toBeChecked());

    await user.click(checkboxes[0]!);
    expect(
      screen.getByText(/Choose groups \(1 selected\)/i),
    ).toBeInTheDocument();
  });

  it("debounces query input and pushes the URL", async () => {
    const user = userEvent.setup();
    render(<SearchControls {...baseProps} />);

    await user.type(screen.getByLabelText("Search query"), "hello");

    await waitFor(() => {
      expect(replace).toHaveBeenCalled();
    });
    const lastUrl = replace.mock.calls.at(-1)?.[0] as string;
    expect(lastUrl).toMatch(/[?&]q=hello(&|$)/);
    expect(lastUrl).toMatch(/[?&]scope=all(&|$)/);
  });

  it("emits a status filter when a status toggle is pressed", async () => {
    const user = userEvent.setup();
    render(<SearchControls {...baseProps} />);

    const statusGroup = screen.getByRole("group", {
      name: "Filter by question status",
    });
    await user.click(
      within(statusGroup).getByRole("button", { name: "Answered" }),
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalled();
    });
    const lastUrl = replace.mock.calls.at(-1)?.[0] as string;
    expect(lastUrl).toMatch(/[?&]status=answered(&|$)/);
  });

  it("debounces the author typeahead and queries the search API", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    render(<SearchControls {...baseProps} />);

    await user.type(screen.getByLabelText("Filter by author"), "jo");

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const [calledUrl, calledInit] = fetchSpy.mock.calls.at(-1) ?? [];
    expect(calledUrl).toMatch(/^\/api\/users\/search\?q=jo&limit=8$/);
    expect(calledInit).toEqual(
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });
});
