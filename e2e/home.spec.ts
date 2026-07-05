import { test, expect } from "@playwright/test";
import { goToLocalMode } from "./helpers";

test.describe("home", () => {
  test("shows mode selection cards", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "O-Route" })).toBeVisible();
    await expect(page.getByTestId("enter-local")).toBeVisible();
    await expect(page.getByTestId("enter-online")).toBeVisible();
  });

  test("local card opens the canvas screen", async ({ page }) => {
    await goToLocalMode(page);
    await expect(page).toHaveURL(/\/local$/);
    await expect(page.getByTestId("canvas-stage")).toBeVisible();
  });
});
