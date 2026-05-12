import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VoteButton } from "./vote-button";
import { voteAction } from "./vote-actions";

vi.mock("./vote-actions", () => ({
  voteAction: vi.fn(),
}));

vi.mock("@/lib/csrf-client", () => ({
  readCsrfToken: vi.fn(() => "test-token"),
}));

const mockedVoteAction = vi.mocked(voteAction);

const baseProps = {
  targetType: "question" as const,
  targetId: "q-1",
  questionId: "q-1",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("VoteButton", () => {
  it("renders the initial score and is not pressed", () => {
    render(<VoteButton {...baseProps} initialScore={3} initialVoted={false} />);
    const button = screen.getByRole("button", { name: "Upvote" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("3");
  });

  it("optimistically increments and reconciles with server result", async () => {
    let resolveVote: (v: Awaited<ReturnType<typeof voteAction>>) => void = () => {};
    mockedVoteAction.mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof voteAction>>>((resolve) => {
          resolveVote = resolve;
        }),
    );

    const user = userEvent.setup();
    render(<VoteButton {...baseProps} initialScore={3} initialVoted={false} />);
    const button = screen.getByRole("button", { name: "Upvote" });

    await user.click(button);

    // Optimistic state: voted=true, score=4
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("4");
    expect(mockedVoteAction).toHaveBeenCalledWith("question", "q-1", "q-1", "test-token");

    await Promise.resolve();
    resolveVote({ ok: true, voted: true, voteScore: 5 });
    await Promise.resolve();

    // Wait for transition microtasks to settle.
    await screen.findByText("5");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("rolls back and surfaces the server error on failure", async () => {
    mockedVoteAction.mockResolvedValue({
      ok: false,
      error: "You can't vote on your own question.",
    });

    const user = userEvent.setup();
    render(<VoteButton {...baseProps} initialScore={3} initialVoted={false} />);
    const button = screen.getByRole("button", { name: "Upvote" });

    await user.click(button);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You can't vote on your own question.");
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("3");
  });

  it("does not invoke the action when disabled", async () => {
    const user = userEvent.setup();
    render(
      <VoteButton
        {...baseProps}
        initialScore={3}
        initialVoted={false}
        disabled
        disabledReason="You can't vote on your own question."
      />,
    );
    const button = screen.getByRole("button", { name: "Upvote" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "You can't vote on your own question.");

    await user.click(button);
    expect(mockedVoteAction).not.toHaveBeenCalled();
  });
});
