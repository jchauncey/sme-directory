import { expect, test } from "./setup";

test("sign in then sign out", async ({ page }) => {
  const email = `e2e-auth-${Date.now()}@example.com`;

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/account");
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("navigation").getByRole("link", { name: "Sign in" })).toBeVisible();
});
