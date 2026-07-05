import { test, expect } from "@playwright/test";
import { goToOnlineRoom, selectMode } from "./helpers";

test.describe("online room", () => {
  test("opens an emulator room and shows the canvas", async ({
    page,
    request,
  }) => {
    await goToOnlineRoom(page, request);
    await expect(page.getByTestId("mode-move")).toBeVisible();
  });

  test("draws in an online room via emulator", async ({ page, request }) => {
    await goToOnlineRoom(page, request);
    await selectMode(page, "draw");

    const canvas = page.getByTestId("canvas-stage").locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box === null) throw new Error("canvas bounding box not found");

    await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width * 0.65,
      box.y + box.height * 0.5,
      { steps: 12 },
    );
    await page.mouse.up();

    await expect(canvas).toBeVisible();
  });

  test("redirects when roomId is missing", async ({ page }) => {
    await page.goto("/online");
    await expect(page).toHaveURL(/\/errors\/room_not_found/, { timeout: 30_000 });
  });
});
