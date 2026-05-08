import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationBell } from "./notification-bell";
import { useSession } from "@/lib/auth-client";
import { csrfFetch } from "@/lib/csrf-client";

vi.mock("@/lib/auth-client", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/csrf-client", () => ({
  csrfFetch: vi.fn(() =>
    Promise.resolve(new Response("{}", { status: 200 })),
  ),
}));

const mockedUseSession = vi.mocked(useSession);
const mockedCsrfFetch = vi.mocked(csrfFetch);

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function emptyNotificationList(unreadCount = 0) {
  return {
    items: [] as unknown[],
    total: 0,
    page: 1,
    per: 20,
    unreadCount,
  };
}

function notification(
  id: string,
  unread: boolean,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    type: "question.created" as const,
    payload: {
      questionId: "q-1",
      questionTitle: "How do I test polling?",
      authorName: "Ada",
      groupName: "Astronomers",
    },
    createdAt: new Date("2026-05-01T12:00:00Z").toISOString(),
    readAt: unread ? null : new Date("2026-05-01T13:00:00Z").toISOString(),
    ...overrides,
  };
}

function authenticated() {
  mockedUseSession.mockReturnValue({
    status: "authenticated",
    data: { user: { id: "u-1", email: "user@example.com", name: "User" } },
  } as unknown as ReturnType<typeof useSession>);
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("NotificationBell", () => {
  beforeEach(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    // Drop the per-test instance descriptor so the prototype getter is
    // visible again on the next test (which redefines it in beforeEach).
    delete (document as unknown as { hidden?: boolean }).hidden;
  });

  it("renders nothing when unauthenticated", () => {
    mockedUseSession.mockReturnValue({
      status: "unauthenticated",
      data: null,
    } as unknown as ReturnType<typeof useSession>);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { container } = render(<NotificationBell />);
    expect(container.firstChild).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches initial notifications and shows the unread badge", async () => {
    authenticated();
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [notification("n-1", true), notification("n-2", true)],
        total: 2,
        page: 1,
        per: 20,
        unreadCount: 2,
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(<NotificationBell />);
    await flush();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("/api/notifications", {
      cache: "no-store",
    });
    expect(
      screen.getByLabelText(/Notifications \(2 unread\)/i),
    ).toBeInTheDocument();
  });

  it("polls every 30 seconds while the tab is visible", async () => {
    authenticated();
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse(emptyNotificationList(0)));
    vi.stubGlobal("fetch", fetchSpy);
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    render(<NotificationBell />);
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("pauses polling when the tab is hidden and resumes on visible", async () => {
    authenticated();
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(jsonResponse(emptyNotificationList(0)));
    vi.stubGlobal("fetch", fetchSpy);
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });

    render(<NotificationBell />);
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flush();
    // Visibility handler refetches immediately and restarts the interval.
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    await flush();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("optimistically marks all notifications read", async () => {
    authenticated();
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [notification("n-1", true), notification("n-2", true)],
        total: 2,
        page: 1,
        per: 20,
        unreadCount: 2,
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    render(<NotificationBell />);
    await flush();

    await user.click(screen.getByLabelText(/Notifications \(2 unread\)/i));
    await user.click(await screen.findByText("Mark all read"));

    expect(mockedCsrfFetch).toHaveBeenCalledWith(
      "/api/notifications/read-all",
      { method: "POST" },
    );
    expect(
      screen.queryByLabelText(/Notifications \(\d+ unread\)/i),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Notifications$/)).toBeInTheDocument();
  });

  it("optimistically marks a single notification read on click", async () => {
    authenticated();
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [
          notification("n-1", true, {
            payload: {
              questionId: "q-1",
              questionTitle: "First notification title",
              authorName: "Ada",
              groupName: "Astronomers",
            },
          }),
          notification("n-2", true, {
            payload: {
              questionId: "q-2",
              questionTitle: "Second notification title",
              authorName: "Grace",
              groupName: "Astronomers",
            },
          }),
        ],
        total: 2,
        page: 1,
        per: 20,
        unreadCount: 2,
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const user = userEvent.setup();
    render(<NotificationBell />);
    await flush();

    await user.click(screen.getByLabelText(/Notifications \(2 unread\)/i));
    const firstItem = await screen.findByText("First notification title");
    await user.click(firstItem);

    expect(mockedCsrfFetch).toHaveBeenCalledWith(
      "/api/notifications/n-1/read",
      { method: "POST" },
    );
    expect(
      screen.getByLabelText(/Notifications \(1 unread\)/i),
    ).toBeInTheDocument();
  });
});
