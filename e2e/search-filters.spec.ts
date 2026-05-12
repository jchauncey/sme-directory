import type { Page } from "@playwright/test";
import { expect, test } from "./setup";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/account");
}

// Base UI's Menu radio item doesn't auto-close the menu on select, and its
// presentation backdrop intercepts pointer events on the next trigger.
// Explicitly dismiss the menu with Escape after each selection.
async function pickFilter(page: Page, triggerName: RegExp, optionName: string): Promise<void> {
  const trigger = page.getByRole("button", { name: triggerName });
  await trigger.click();
  await page.getByRole("menuitemradio", { name: optionName, exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
}

test("search filter dropdowns drive the URL and active chips", async ({ page }) => {
  test.slow();

  const ts = Date.now();
  const email = `search-filter-${ts}@example.com`;
  const groupName = `Search Filter Group ${ts}`;
  const expectedSlug = `search-filter-group-${ts}`;
  const marker = `searchfilter${ts}`;
  const openTitle = `Open ${marker} question`;
  const answeredTitle = `Answered ${marker} question`;

  await signIn(page, email);

  // Seed: a group with two questions sharing the marker — one stays open, one
  // gets an accepted answer so the "answered" filter has something to bite on.
  await page.goto("/groups/new");
  await page.getByLabel("Name").fill(groupName);
  await expect(page.locator("#slug-status")).toHaveText("Available");
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(`/groups/${expectedSlug}`);

  await page.getByRole("link", { name: "Ask a question" }).click();
  await page.getByLabel("Title").fill(openTitle);
  await page.getByLabel(/^Body/).fill(`Body for ${marker} open.`);
  await page.getByRole("button", { name: "Post question" }).click();
  await expect(page).toHaveURL(/\/q\/[a-z0-9-]+$/i);

  await page.goto(`/groups/${expectedSlug}/ask`);
  await page.getByLabel("Title").fill(answeredTitle);
  await page.getByLabel(/^Body/).fill(`Body for ${marker} answered.`);
  await page.getByRole("button", { name: "Post question" }).click();
  await expect(page).toHaveURL(/\/q\/[a-z0-9-]+$/i);

  await page.getByLabel(/^Your answer/).fill(`Resolved ${marker}.`);
  await page.getByRole("button", { name: "Post answer" }).click();
  await page.getByRole("button", { name: "Accept this answer" }).click();
  await expect(page.getByText("✓ Accepted answer")).toBeVisible();

  await page.goto(`/search?q=${encodeURIComponent(marker)}`);

  const openLinks = page.getByRole("link", { name: new RegExp(openTitle, "i") });
  const answeredLinks = page.getByRole("link", {
    name: new RegExp(answeredTitle, "i"),
  });

  // Both questions surface before any filter is applied. The answered one also
  // produces an answer-card hit, so we assert >=1 link rather than ==1.
  await expect(openLinks.first()).toBeVisible();
  await expect(answeredLinks.first()).toBeVisible();

  // Status trigger advertises its current value to assistive tech without
  // requiring the menu to be opened.
  const statusTrigger = page.getByRole("button", {
    name: /Filter by question status, currently All/i,
  });
  await expect(statusTrigger).toBeVisible();

  // Pick "Answered" via the dropdown — URL syncs and the open question drops out.
  await pickFilter(page, /Filter by question status/i, "Answered");
  await expect(page).toHaveURL(/[?&]status=answered(&|$)/);
  await expect(answeredLinks.first()).toBeVisible();
  await expect(openLinks).toHaveCount(0);

  // The active-filters chip reflects the selection and the trigger now
  // announces "Answered" as the current value.
  const filtersRegion = page.getByRole("region", { name: "Active filters" });
  await expect(filtersRegion.getByText("Status: Answered")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Filter by question status, currently Answered/i,
    }),
  ).toBeVisible();

  // Sort dropdown writes sort=newest to the URL.
  await pickFilter(page, /Sort results/i, "Newest");
  await expect(page).toHaveURL(/[?&]sort=newest(&|$)/);
  await expect(filtersRegion.getByText("Sort: Newest")).toBeVisible();

  // Date dropdown writes range=year to the URL.
  await pickFilter(page, /Filter by date range/i, "Past year");
  await expect(page).toHaveURL(/[?&]range=year(&|$)/);
  await expect(filtersRegion.getByText("Date: Past year")).toBeVisible();

  // Clearing a chip removes it from the URL and brings the matching content back
  // when relevant. Clear status → both questions are visible again.
  await filtersRegion.getByRole("link", { name: /Clear Status: Answered/i }).click();
  await expect(page).not.toHaveURL(/[?&]status=answered(&|$)/);
  await expect(openLinks.first()).toBeVisible();
  await expect(answeredLinks.first()).toBeVisible();

  // "Clear all" wipes the remaining filters and the chips region disappears.
  await filtersRegion.getByRole("link", { name: "Clear all" }).click();
  await expect(page).toHaveURL(/^[^?]*\/search\?q=/);
  await expect(page.getByRole("region", { name: "Active filters" })).toHaveCount(0);
});
