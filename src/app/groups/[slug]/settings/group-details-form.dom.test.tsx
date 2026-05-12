import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GroupDetailsForm } from "./group-details-form";
import { updateGroupDetailsAction } from "./actions";

vi.mock("./actions", () => ({
  updateGroupDetailsAction: vi.fn(),
}));

vi.mock("@/components/csrf-field", () => ({
  CsrfField: () => <input type="hidden" name="_csrf" value="test-token" />,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockedAction = vi.mocked(updateGroupDetailsAction);

afterEach(() => {
  vi.clearAllMocks();
});

describe("GroupDetailsForm", () => {
  it("renders inputs prefilled with the current values", () => {
    render(
      <GroupDetailsForm
        slug="my-group"
        initialName="My group"
        initialDescription="An existing description."
      />,
    );
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("My group");
    expect(screen.getByLabelText(/description/i)).toHaveValue(
      "An existing description.",
    );
  });

  it("renders an empty description textarea when none is set", () => {
    render(
      <GroupDetailsForm slug="my-group" initialName="My group" initialDescription={null} />,
    );
    expect(screen.getByLabelText(/description/i)).toHaveValue("");
  });

  it("submits the form data to the server action", async () => {
    mockedAction.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <GroupDetailsForm slug="my-group" initialName="Old" initialDescription={null} />,
    );

    const nameInput = screen.getByLabelText(/^name$/i);
    await user.clear(nameInput);
    await user.type(nameInput, "New name");
    await user.type(screen.getByLabelText(/description/i), "Fresh description");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(mockedAction).toHaveBeenCalledTimes(1));
    const fd = mockedAction.mock.calls[0]?.[1] as FormData;
    expect(fd.get("slug")).toBe("my-group");
    expect(fd.get("name")).toBe("New name");
    expect(fd.get("description")).toBe("Fresh description");
    expect(fd.get("_csrf")).toBe("test-token");
  });

  it("renders field errors returned by the action", async () => {
    mockedAction.mockResolvedValue({
      fieldErrors: [{ path: "name", message: "Name must be at least 2 characters." }],
      values: { name: "x", description: "" },
    });
    const user = userEvent.setup();
    render(
      <GroupDetailsForm slug="my-group" initialName="Valid" initialDescription={null} />,
    );

    const nameInput = screen.getByLabelText(/^name$/i);
    await user.clear(nameInput);
    await user.type(nameInput, "x");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((el) => /at least 2 characters/i.test(el.textContent ?? ""))).toBe(
      true,
    );
    expect(nameInput).toHaveAttribute("aria-invalid", "true");
  });

  it("renders a top-level error returned by the action", async () => {
    mockedAction.mockResolvedValue({
      error: "Only the owner can change settings.",
      values: { name: "Hijack", description: "" },
    });
    const user = userEvent.setup();
    render(
      <GroupDetailsForm slug="my-group" initialName="Valid" initialDescription={null} />,
    );

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((el) => /only the owner/i.test(el.textContent ?? ""))).toBe(true);
  });
});
