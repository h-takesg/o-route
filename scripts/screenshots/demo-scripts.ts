import type { Page } from "@playwright/test";
import { selectMode } from "../../e2e/helpers";
import {
  applyScreenshotView,
  buildDrawPathFromWaypoints,
  centerMapPoint,
  drawRouteOnMap,
  ensureMapPointsVisibleInViewport,
  getStageDimensions,
  mapPointToPageCoords,
  panByStageDelta,
  rotateToDegrees,
  rotateViewWheel,
  settleForScreenshot,
  type RouteLegMeta,
  type ScreenshotViewTarget,
  waitForViewSettled,
  zoomToScale,
  zoomWheel,
} from "./capture-utils";
import type { MapPoint } from "./course-data";
import type { RouteWaypoints } from "./routes";
import {
  VIDEO_TARGET_SECONDS,
  VideoFrameBuffer,
  addOverlayToPng,
  canvasCenterOverlay,
  compositeSideBySidePng,
  recordFrame,
  type FrameOverlay,
} from "./video-capture";

export type LegDef = { waypoints: RouteWaypoints; meta: RouteLegMeta };

async function drawRawPointsRecorded(
  page: Page,
  buffer: VideoFrameBuffer,
  points: readonly MapPoint[],
  sampleEvery = 3,
): Promise<void> {
  await selectMode(page, "draw");
  const first = await mapPointToPageCoords(page, points[0][0], points[0][1]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  await recordFrame(page, buffer, { cursorX: first.x, cursorY: first.y });
  for (let i = 1; i < points.length; i += 1) {
    const p = await mapPointToPageCoords(page, points[i][0], points[i][1]);
    await page.mouse.move(p.x, p.y, { steps: 3 });
    if (i % sampleEvery === 0 || i === points.length - 1) {
      await recordFrame(page, buffer, { cursorX: p.x, cursorY: p.y });
    }
  }
  await page.mouse.up();
}

export async function recordIntroHold(
  page: Page,
  buffer: VideoFrameBuffer,
  frames: number,
  overlay?: FrameOverlay,
): Promise<void> {
  for (let i = 0; i < frames; i += 1) {
    await recordFrame(page, buffer, overlay);
  }
}

export async function recordViewTweenToTarget(
  page: Page,
  buffer: VideoFrameBuffer,
  target: ScreenshotViewTarget,
  frames: number,
): Promise<void> {
  await selectMode(page, "move");
  const { width, height } = await getStageDimensions(page);
  for (let i = 1; i <= frames; i += 1) {
    const t = i / frames;
    await rotateToDegrees(page, target.targetRotationDeg * t);
    const scale = 0.38 + (target.targetScale - 0.38) * t;
    await zoomToScale(page, scale);
    await centerMapPoint(page, target.centerMapX, target.centerMapY, width, height);
    const center = await canvasCenterOverlay(page);
    await recordFrame(page, buffer, {
      ...center,
      hint: i % 6 === 0 ? "wheel" : undefined,
    });
  }
}

export async function drawLegRecorded(
  page: Page,
  buffer: VideoFrameBuffer,
  leg: LegDef,
  sampleEvery = 3,
): Promise<void> {
  await selectMode(page, "draw");
  const points = buildDrawPathFromWaypoints(leg.waypoints, leg.meta);
  const first = await mapPointToPageCoords(page, points[0][0], points[0][1]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  await recordFrame(page, buffer, { cursorX: first.x, cursorY: first.y });
  for (let i = 1; i < points.length; i += 1) {
    const p = await mapPointToPageCoords(page, points[i][0], points[i][1]);
    await page.mouse.move(p.x, p.y, { steps: 3 });
    if (i % sampleEvery === 0 || i === points.length - 1) {
      await recordFrame(page, buffer, { cursorX: p.x, cursorY: p.y });
    }
  }
  await page.mouse.up();
  await page.waitForTimeout(80);
}

export async function recordHeroDemo(
  page: Page,
  buffer: VideoFrameBuffer,
  target: ScreenshotViewTarget,
  legs: readonly LegDef[],
): Promise<void> {
  await recordIntroHold(page, buffer, 8, await canvasCenterOverlay(page));
  await recordViewTweenToTarget(page, buffer, target, 20);
  for (const leg of legs) {
    await drawLegRecorded(page, buffer, leg, 4);
  }
}

export async function recordRotateDemo(
  page: Page,
  buffer: VideoFrameBuffer,
  target: ScreenshotViewTarget,
  leg: LegDef,
): Promise<void> {
  await selectMode(page, "move");
  await recordIntroHold(page, buffer, 8, await canvasCenterOverlay(page));
  const canvas = page.locator('[data-testid="canvas-stage"]');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error("canvas missing");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (let i = 0; i < 10; i += 1) {
    await page.mouse.move(cx - 80 + i * 16, cy - 40 + i * 8);
    await page.mouse.down();
    await page.mouse.move(cx - 80 + i * 16 + 40, cy - 40 + i * 8 + 20, { steps: 4 });
    await page.mouse.up();
    await recordFrame(page, buffer, { cursorX: cx, cursorY: cy });
  }
  for (let i = 0; i < 8; i += 1) {
    await zoomWheel(page, i % 2 === 0 ? -140 : 140, 1);
    await recordFrame(page, buffer, { cursorX: cx, cursorY: cy, hint: "wheel" });
  }
  for (let i = 0; i < 12; i += 1) {
    await rotateViewWheel(page, 18, 1);
    await recordFrame(page, buffer, { cursorX: cx, cursorY: cy, hint: "ctrl-wheel" });
  }
  await applyScreenshotView(page, target);
  await drawLegRecorded(page, buffer, leg, 4);
}

export async function recordDrawEraseDemo(
  page: Page,
  buffer: VideoFrameBuffer,
  north: LegDef,
  south: LegDef,
): Promise<void> {
  await drawLegRecorded(page, buffer, north, 4);
  await drawLegRecorded(page, buffer, south, 4);
  await drawRawPointsRecorded(
    page,
    buffer,
    [
      [1500, 950],
      [1420, 900],
      [1340, 880],
    ],
    2,
  );
  await selectMode(page, "erase");
  const mid = await mapPointToPageCoords(page, 1380, 890);
  await page.mouse.move(mid.x, mid.y);
  await page.mouse.down();
  await page.mouse.move(mid.x + 24, mid.y + 16, { steps: 4 });
  await page.mouse.up();
  await recordFrame(page, buffer, { cursorX: mid.x, cursorY: mid.y });
}

export async function recordSharingMotion(
  pageA: Page,
  pageB: Page,
  buffer: VideoFrameBuffer,
  target: ScreenshotViewTarget,
  frames: number,
): Promise<void> {
  await applyScreenshotView(pageA, target);
  await selectMode(pageA, "move");
  const box = await pageA.locator('[data-testid="canvas-stage"]').boundingBox();
  if (box === null) throw new Error("canvas missing");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (let i = 0; i < frames; i += 1) {
    await panByStageDelta(pageA, i % 2 === 0 ? 28 : -22, i % 3 === 0 ? 18 : -12);
    if (i % 4 === 0) await zoomWheel(pageA, -120, 1);
    if (i % 5 === 0) await rotateViewWheel(pageA, 12, 1);
    await waitForViewSettled(pageB);
    await settleForScreenshot(pageA);
    await settleForScreenshot(pageB);
    const left = await pageA.screenshot({ type: "png" });
    const right = await pageB.screenshot({ type: "png" });
    const composite = await compositeSideBySidePng(pageA, left, right);
    const hint: FrameOverlay = {
      cursorX: cx + (i % 5) * 8,
      cursorY: cy + (i % 4) * 6,
      hint: i % 6 === 0 ? "wheel" : undefined,
    };
    buffer.push(await addOverlayToPng(pageA, composite, hint));
  }
}

export function finalizeVideoBuffer(buffer: VideoFrameBuffer, stillPng: Buffer): Buffer[] {
  buffer.padToDuration(24, VIDEO_TARGET_SECONDS, stillPng);
  const frames = buffer.frames;
  frames[frames.length - 1] = stillPng;
  return frames;
}
