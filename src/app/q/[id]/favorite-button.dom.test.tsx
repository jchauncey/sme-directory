import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FavoriteButton } from "./favorite-button";
import { favoriteAction } from "./favorite-actions";

vi.mock("./favorite-actions", () => ({
  favoriteAction: vi.fn(),
}));

vi.mock("@/lib/csrf-client", () => ({
  readCsrfToken: vi.fn(() => "test-token"),
}));

const mockedFavoriteAction = vi.mocked(favoriteAction);

const baseProps = {
  targetType: "question" as const,
  targetId: "q-1",
  questionId: "q-1",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("FavoriteButton", () => {
  it("renders not favorited initially", () => {
    render(<FavoriteButton {...baseProps} initialFavorited={false} />);
    const button = screen.getByRole("button", { name: "Add to favorites" });
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("optimistically toggles and confirms with server", async () => {
    let resolveFavorite: (v: Awaited<ReturnType<typeof favoriteAction>>) => void = () => {};
    mockedFavoriteAction.mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof favoriteAction>>>((resolve) => {
          resolveFavorite = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<FavoriteButton {...baseProps} initialFavorited={false} />);
    const button = screen.getByRole("button", { name: "Add to favorites" });

    await user.click(button);

    // Optimistic flip happens before the server resolves.
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveAttribute("aria-label", "Remove from favorites");
    expect(mockedFavoriteAction).toHaveBeenCalledWith("question", "q-1", "q-1", "test-token");

    resolveFavorite({ ok: true, favorited: true });

    // Reconciliation preserves the optimistic state.
    await screen.findByRole("button", { name: "Remove from favorites" });
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("rolls back and surfaces the server error on failure", async () => {
    mockedFavoriteAction.mockResolvedValue({
      ok: false,
      error: "You must be approved in this group to favorite.",
    });

    const user = userEvent.setup();
    render(<FavoriteButton {...baseProps} initialFavorited={false} />);
    const button = screen.getByRole("button", { name: "Add to favorites" });

    await user.click(button);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You must be approved in this group to favorite.");
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("does not invoke the action when disabled", async () => {
    const user = userEvent.setup();
    render(
      <FavoriteButton
        {...baseProps}
        initialFavorited={false}
        disabled
        disabledReason="Sign in to favorite."
      />,
    );
    const button = screen.getByRole("button", { name: "Add to favorites" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Sign in to favorite.");

    await user.click(button);
    expect(mockedFavoriteAction).not.toHaveBeenCalled();
  });
});
