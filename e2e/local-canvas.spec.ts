import { test, expect } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  canvasHasRedStroke,
  drawStrokeOnCanvas,
  goToLocalMode,
  selectMode,
  waitForCanvas,
} from "./helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sampleMap = path.join(__dirname, "fixtures", "sample-map.png");

test.describe("local canvas", () => {
  test.beforeEach(async ({ page }) => {
    await goToLocalMode(page);
  });

  test("toolbar switches draw mode", async ({ page }) => {
    await selectMode(page, "draw");
    await selectMode(page, "move");
    await selectMode(page, "erase");
  });

  test("draws a red stroke on the canvas", async ({ page }) => {
    await selectMode(page, "draw");
    await drawStrokeOnCanvas(page);
    await expect.poll(() => canvasHasRedStroke(page)).toBe(true);
  });

  test("accepts map image upload", async ({ page }) => {
    await page.getByTestId("load-image").click();
    await page.locator('input[type="file"]').setInputFiles(sampleMap);
    await expect(page.getByTestId("canvas-stage")).toBeVisible();
    await expect(page.getByTestId("load-image")).toBeVisible();
  });

  test("clears drawn lines with all-clear", async ({ page }) => {
    await selectMode(page, "draw");
    await drawStrokeOnCanvas(page);
    await expect.poll(() => canvasHasRedStroke(page)).toBe(true);

    await page.getByTestId("clear-all").click();
    await expect.poll(() => canvasHasRedStroke(page)).toBe(false);
  });

  test("canvas is interactive in move mode (pan)", async ({ page }) => {
    await selectMode(page, "move");
    const canvas = await waitForCanvas(page);
    const box = await canvas.boundingBox();
    if (box === null) throw new Error("canvas bounding box not found");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 80,
      box.y + box.height / 2 + 40,
      { steps: 8 },
    );
    await page.mouse.up();

    await expect(canvas).toBeVisible();
  });
});
