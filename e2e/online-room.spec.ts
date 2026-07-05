import { test, expect } from "@playwright/test";
import {
  canvasHasRedStroke,
  drawStrokeOnCanvas,
  drawStrokeOnCanvasAt,
  getRoomLineCount,
  goToOnlineRoom,
  selectMode,
  waitForCanvasLinesSnapshot,
  waitForRoomLinesSnapshot,
} from "./helpers";

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

  test("erases own drawn line in online room", async ({ page, request }) => {
    const roomId = await goToOnlineRoom(page, request);
    await selectMode(page, "draw");
    await drawStrokeOnCanvas(page);
    await expect.poll(() => canvasHasRedStroke(page)).toBe(true);

    await selectMode(page, "erase");
    await drawStrokeOnCanvas(page);

    await expect.poll(() => canvasHasRedStroke(page)).toBe(false);
    await expect.poll(() => getRoomLineCount(request, roomId)).toBe(0);
  });

  test("stores a single firebase line per stroke", async ({ page, request }) => {
    const roomId = await goToOnlineRoom(page, request);
    await selectMode(page, "draw");
    await drawStrokeOnCanvas(page);

    const snapshot = await waitForRoomLinesSnapshot(request, roomId, {
      lineCount: 1,
      minPointCount: 6,
    });
    expect(snapshot.lines[0]?.isDrawing).toBe(false);
  });

  test("reload preserves all drawn lines with full points", async ({ page, request }) => {
    const roomId = await goToOnlineRoom(page, request);
    await selectMode(page, "draw");

    await drawStrokeOnCanvasAt(page, 0.35, 0.4, 0.65, 0.4);
    await drawStrokeOnCanvasAt(page, 0.3, 0.65, 0.7, 0.65);

    const snapshotBefore = await waitForRoomLinesSnapshot(request, roomId, {
      lineCount: 2,
      minPointCount: 6,
    });
    await waitForCanvasLinesSnapshot(page, snapshotBefore);

    await page.reload();
    await page.waitForURL(new RegExp(`/online\\?roomId=${roomId}`));

    const snapshotAfterDb = await waitForRoomLinesSnapshot(request, roomId, {
      lineCount: 2,
      minPointCount: 6,
    });
    expect(snapshotAfterDb).toEqual(snapshotBefore);

    await waitForCanvasLinesSnapshot(page, snapshotAfterDb);
    await expect.poll(() => canvasHasRedStroke(page)).toBe(true);

    for (const line of snapshotAfterDb.lines) {
      const firstX = line.points[0];
      const firstY = line.points[1];
      const lastX = line.points[line.points.length - 2];
      const lastY = line.points[line.points.length - 1];
      expect(firstX).not.toBe(lastX);
      expect(line.points.length).toBeGreaterThanOrEqual(6);
      expect(Number.isFinite(firstY)).toBe(true);
      expect(Number.isFinite(lastY)).toBe(true);
    }
  });

  test("redirects when roomId is missing", async ({ page }) => {
    await page.goto("/online");
    await expect(page).toHaveURL(/\/errors\/room_not_found/, { timeout: 30_000 });
  });
});
