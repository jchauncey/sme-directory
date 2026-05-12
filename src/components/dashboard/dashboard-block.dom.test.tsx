import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DashboardBlock } from "./dashboard-block";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

function renderBlock(id = "test-block") {
  return render(
    <DashboardBlock id={id} title="Top groups" link={{ href: "/groups", label: "See more" }}>
      <p data-testid="body">block contents</p>
    </DashboardBlock>,
  );
}

describe("DashboardBlock", () => {
  it("renders expanded by default and toggles to collapsed on click", async () => {
    const user = userEvent.setup();
    renderBlock();

    const toggle = screen.getByRole("button", { name: "Hide Top groups" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("body")).toBeVisible();

    await user.click(toggle);

    const reToggle = screen.getByRole("button", { name: "Show Top groups" });
    expect(reToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("body")).not.toBeVisible();
  });

  it("persists collapsed state to localStorage and rehydrates on re-render", async () => {
    const user = userEvent.setup();
    const { unmount } = renderBlock("persist-id");

    await user.click(screen.getByRole("button", { name: "Hide Top groups" }));

    const stored = window.localStorage.getItem("sme:dashboard:collapsed");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual({ "persist-id": true });

    unmount();
    renderBlock("persist-id");

    expect(screen.getByRole("button", { name: "Show Top groups" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("reacts to localStorage changes from another tab via the storage event", async () => {
    renderBlock("cross-tab");
    expect(screen.getByRole("button", { name: "Hide Top groups" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await act(async () => {
      window.localStorage.setItem("sme:dashboard:collapsed", JSON.stringify({ "cross-tab": true }));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "sme:dashboard:collapsed",
          newValue: JSON.stringify({ "cross-tab": true }),
        }),
      );
    });

    expect(screen.getByRole("button", { name: "Show Top groups" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("renders the right-side link", () => {
    renderBlock();
    const link = screen.getByRole("link", { name: "See more" });
    expect(link).toHaveAttribute("href", "/groups");
  });
});
