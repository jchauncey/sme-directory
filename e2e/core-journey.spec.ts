import type { Page } from "@playwright/test";
import { expect, test } from "./setup";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/account");
}

test("canonical owner→applicant journey", async ({ browser }) => {
  test.slow();

  const ts = Date.now();
  const ownerEmail = `owner-${ts}@example.com`;
  const applicantEmail = `applicant-${ts}@example.com`;
  const groupName = `E2E Group ${ts}`;
  const expectedSlug = `e2e-group-${ts}`;
  // Single FTS5 token (no hyphens/spaces) so the search step is unambiguous.
  const marker = `e2emarker${ts}`;
  const questionTitle = `How do I configure ${marker}?`;
  const questionBody = `Looking for guidance on ${marker}. Steps tried: none yet.`;
  const answerBody = `Use the ${marker} flag — works for our setup.`;

  const ownerContext = await browser.newContext();
  const applicantContext = await browser.newContext();

  try {
    const ownerPage = await ownerContext.newPage();
    const applicantPage = await applicantContext.newPage();

    // 1. Owner signs in.
    await signIn(ownerPage, ownerEmail);

    // 2. Owner creates a group (autoApprove unchecked → applications need review).
    await ownerPage.goto("/groups/new");
    await ownerPage.getByLabel("Name").fill(groupName);
    // Slug derives from name; wait for the async availability check to land.
    await expect(ownerPage.locator("#slug-status")).toHaveText("Available");
    await ownerPage.getByLabel("Description (optional)").fill("Created by an e2e test.");
    await ownerPage.getByRole("button", { name: "Create group" }).click();
    await expect(ownerPage).toHaveURL(`/groups/${expectedSlug}`);

    // 3. Applicant signs in.
    await signIn(applicantPage, applicantEmail);

    // 4. Applicant applies.
    await applicantPage.goto(`/groups/${expectedSlug}`);
    await applicantPage.getByRole("button", { name: "Apply to join" }).click();
    await expect(applicantPage.getByText("Application pending review.")).toBeVisible();

    // 5. Owner approves.
    await ownerPage.goto(`/groups/${expectedSlug}/settings`);
    const applicantRow = ownerPage
      .getByTestId("pending-application-row")
      .filter({ hasText: applicantEmail });
    await expect(applicantRow).toBeVisible();
    await applicantRow.getByRole("button", { name: "Approve" }).click();
    await expect(ownerPage.getByText("No pending applications.")).toBeVisible();

    // 6. Applicant asks a question.
    await applicantPage.goto(`/groups/${expectedSlug}`);
    await applicantPage.getByRole("link", { name: "Ask a question" }).click();
    await expect(applicantPage).toHaveURL(`/groups/${expectedSlug}/ask`);
    await applicantPage.getByLabel("Title").fill(questionTitle);
    await applicantPage.getByLabel(/^Body/).fill(questionBody);
    await applicantPage.getByRole("button", { name: "Post question" }).click();
    await expect(applicantPage).toHaveURL(/\/q\/[a-z0-9-]+$/i);
    const questionUrl = new URL(applicantPage.url()).pathname;

    // 7. Owner answers.
    await ownerPage.goto(questionUrl);
    await ownerPage.getByLabel(/^Your answer/).fill(answerBody);
    await ownerPage.getByRole("button", { name: "Post answer" }).click();
    await expect(ownerPage.getByText(answerBody)).toBeVisible();

    // 8. Applicant accepts the answer.
    await applicantPage.goto(questionUrl);
    await applicantPage.getByRole("button", { name: "Accept this answer" }).click();
    await expect(applicantPage.getByText("✓ Accepted answer")).toBeVisible();

    // 9. Applicant favorites the question.
    const favoriteButton = applicantPage
      .getByRole("button", { name: "Add to favorites" })
      .first();
    await favoriteButton.click();
    await expect(
      applicantPage.getByRole("button", { name: "Remove from favorites" }).first(),
    ).toBeVisible();

    // 10. Search returns the question.
    await applicantPage.goto(`/search?q=${encodeURIComponent(marker)}`);
    const result = applicantPage.getByRole("link", { name: new RegExp(marker, "i") });
    await expect(result.first()).toBeVisible();
    await expect(result.first()).toHaveAttribute("href", new RegExp("^/q/"));
  } finally {
    await ownerContext.close();
    await applicantContext.close();
  }
});
