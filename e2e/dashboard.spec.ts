import type { Page } from "@playwright/test";
import { expect, test } from "./setup";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/account");
}

test("home dashboard surfaces favorited groups and recent open questions", async ({
  page,
}) => {
  test.slow();

  const ts = Date.now();
  const email = `dash-${ts}@example.com`;
  const groupName = `Dash Group ${ts}`;
  const expectedSlug = `dash-group-${ts}`;
  const questionTitle = `Dashboard open question ${ts}`;

  await signIn(page, email);

  // Seed: create a group and ask one open question in it so the home page has
  // something to render for "Recent open questions".
  await page.goto("/groups/new");
  await page.getByLabel("Name").fill(groupName);
  await expect(page.locator("#slug-status")).toHaveText("Available");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(`/groups/${expectedSlug}`);

  await page.getByRole("link", { name: "Ask a question" }).click();
  await expect(page).toHaveURL(`/groups/${expectedSlug}/ask`);
  await page.getByLabel("Title").fill(questionTitle);
  await page.getByLabel(/^Body/).fill("Open question body for dashboard test.");
  await page.getByRole("button", { name: "Post question" }).click();
  await expect(page).toHaveURL(/\/q\/[a-z0-9-]+$/i);

  // Dashboard blocks render and the question shows under "Recent open questions".
  await page.goto("/");
  // CardTitle renders as a div, so probe via the per-block toggle button.
  await expect(page.getByRole("button", { name: /Top groups$/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Your favorite groups$/ }),
  ).toBeVisible();
  const openQuestions = page.locator("#dashboard-block-body-open-questions");
  await expect(
    openQuestions.getByRole("link", { name: questionTitle }),
  ).toBeVisible();

  // Empty favorites preview before we star anything.
  const favorites = page.locator("#dashboard-block-body-favorite-groups");
  await expect(favorites.getByText(/No favorites yet/i)).toBeVisible();

  // Favorite the group from its detail page. The button optimistically flips
  // before the server action commits — wait for the transition to settle
  // (button re-enabled) so the favorite is persisted before we navigate away.
  await page.goto(`/groups/${expectedSlug}`);
  await page.getByRole("button", { name: "Add to favorites" }).click();
  const unfavoriteButton = page.getByRole("button", { name: "Remove from favorites" });
  await expect(unfavoriteButton).toBeVisible();
  await expect(unfavoriteButton).toBeEnabled();

  // Group now appears in the dashboard favorites preview.
  await page.goto("/");
  await expect(favorites.getByRole("link", { name: groupName })).toBeVisible();

  // …and on /me/favorites under the Groups section.
  await page.goto("/me/favorites");
  await expect(page.getByRole("heading", { name: /^Groups \(\d+\)$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: groupName })).toBeVisible();

  // Unfavorite — the preview returns to the empty state.
  await page.goto(`/groups/${expectedSlug}`);
  await page.getByRole("button", { name: "Remove from favorites" }).click();
  const favoriteButton = page.getByRole("button", { name: "Add to favorites" });
  await expect(favoriteButton).toBeVisible();
  await expect(favoriteButton).toBeEnabled();

  await page.goto("/");
  await expect(favorites.getByText(/No favorites yet/i)).toBeVisible();
  await expect(favorites.getByRole("link", { name: groupName })).toHaveCount(0);
});

test("dashboard block collapse state persists across reloads", async ({ page }) => {
  const email = `dash-collapse-${Date.now()}@example.com`;
  await signIn(page, email);

  await page.goto("/");
  const hide = page.getByRole("button", { name: "Hide Top groups" });
  await expect(hide).toBeVisible();
  await hide.click();

  // After collapse, the toggle flips and the body is hidden.
  await expect(page.getByRole("button", { name: "Show Top groups" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );

  await page.reload();
  await expect(page.getByRole("button", { name: "Show Top groups" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
