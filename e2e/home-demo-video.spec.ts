import { test, expect } from "@playwright/test";

test.describe("home demo video", () => {
  test("shows poster only until play; rotate demo mounts video with src", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("video")).toHaveCount(0);

    const playRotate = page.getByTestId("demo-play-rotate");
    await playRotate.scrollIntoViewIfNeeded();
    await playRotate.click();

    const video = page.getByTestId("demo-video-rotate");
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("src", "/images/home/rotate.webm");
  });
});
