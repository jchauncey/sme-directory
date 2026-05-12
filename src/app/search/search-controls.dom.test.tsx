import { render, screen, waitFor } from "@testing-library/react";
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
    expect(myGroupsButton).toHaveAttribute("title", "Join a group to use this scope.");
  });

  it("reveals checkboxes for every group when Pick groups is selected", async () => {
    const user = userEvent.setup();
    render(<SearchControls {...baseProps} />);

    await user.click(screen.getByRole("button", { name: "Pick groups" }));

    const checkboxes = await screen.findAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);
    checkboxes.forEach((cb) => expect(cb).not.toBeChecked());

    await user.click(checkboxes[0]!);
    expect(screen.getByText(/Choose groups \(1 selected\)/i)).toBeInTheDocument();
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

  it("emits a status filter when a status option is picked from the dropdown", async () => {
    const user = userEvent.setup();
    render(<SearchControls {...baseProps} />);

    const trigger = screen.getByRole("button", {
      name: /Filter by question status/i,
    });
    // Accessible name must include the current value so screen readers can
    // announce it without opening the menu.
    expect(trigger).toHaveAccessibleName(/currently All/i);

    await user.click(trigger);
    await user.click(await screen.findByRole("menuitemradio", { name: "Answered" }));

    await waitFor(() => {
      expect(replace).toHaveBeenCalled();
    });
    const lastUrl = replace.mock.calls.at(-1)?.[0] as string;
    expect(lastUrl).toMatch(/[?&]status=answered(&|$)/);
  });

  it("emits range and sort filters when their dropdowns are used", async () => {
    const user = userEvent.setup();
    render(<SearchControls {...baseProps} />);

    await user.click(screen.getByRole("button", { name: /Filter by date range/i }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Past week" }));
    await waitFor(() => {
      const last = replace.mock.calls.at(-1)?.[0] as string | undefined;
      expect(last).toMatch(/[?&]range=week(&|$)/);
    });

    await user.click(screen.getByRole("button", { name: /Sort results/i }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Newest" }));
    await waitFor(() => {
      const last = replace.mock.calls.at(-1)?.[0] as string | undefined;
      expect(last).toMatch(/[?&]sort=newest(&|$)/);
    });
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
    expect(calledInit).toEqual(expect.objectContaining({ credentials: "same-origin" }));
  });
});
