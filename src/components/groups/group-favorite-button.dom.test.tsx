import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GroupFavoriteButton } from "./group-favorite-button";
import { favoriteGroupAction } from "@/app/groups/[slug]/favorite-actions";

vi.mock("@/app/groups/[slug]/favorite-actions", () => ({
  favoriteGroupAction: vi.fn(),
}));

vi.mock("@/lib/csrf-client", () => ({
  readCsrfToken: vi.fn(() => "test-token"),
}));

const mocked = vi.mocked(favoriteGroupAction);

afterEach(() => {
  vi.clearAllMocks();
});

describe("GroupFavoriteButton", () => {
  it("renders not favorited initially", () => {
    render(<GroupFavoriteButton groupId="g-1" slug="g" initialFavorited={false} />);
    const button = screen.getByRole("button", { name: "Add to favorites" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("optimistically toggles on click and confirms with server", async () => {
    let resolveFn: (v: Awaited<ReturnType<typeof favoriteGroupAction>>) => void = () => {};
    mocked.mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof favoriteGroupAction>>>((resolve) => {
          resolveFn = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<GroupFavoriteButton groupId="g-1" slug="g" initialFavorited={false} />);
    const button = screen.getByRole("button", { name: "Add to favorites" });

    await user.click(button);

    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(mocked).toHaveBeenCalledWith("g-1", "g", "test-token");

    resolveFn({ ok: true, favorited: true });

    await screen.findByRole("button", { name: "Remove from favorites" });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("rolls back and surfaces the server error", async () => {
    mocked.mockResolvedValue({ ok: false, error: "Could not update favorite." });

    const user = userEvent.setup();
    render(<GroupFavoriteButton groupId="g-1" slug="g" initialFavorited={false} />);
    const button = screen.getByRole("button", { name: "Add to favorites" });

    await user.click(button);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not update favorite.");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });
});
