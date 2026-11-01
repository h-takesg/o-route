import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";
import {
  canvasHasRedStroke,
  getKonvaViewGroupTransform,
  goToOnlineRoom,
  selectMode,
  uploadMapImage,
  waitForCanvas,
  waitForKonvaMapImage,
} from "../../e2e/helpers";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, "../..");

export const REPO_ROOT = repoRoot;
export const SAMPLE_MAP_PATH = path.join(scriptsDir, "sample-map.png");
export const HOME_IMAGES_DIR = path.join(repoRoot, "public", "images", "home");

/** Left overlay toolbar width (approx.) — route points must be to the right of this. */
export const TOOLBAR_GUTTER_PX = 110;

/** Course geometry from generate-sample-map.mjs (map pixel coordinates). */
export const MAP = {
  width: 2400,
  height: 1700,
  start: [380, 580] as const,
  controls: [
    [620, 310],
    [830, 560],
    [1790, 390],
    [1500, 660],
    [1340, 780],
    [620, 1040],
    [740, 800],
  ] as const,
  finish: [1900, 1380] as const,
  lakeCenter: [1150, 1140] as const,
  knollHill: [620, 340] as const,
};

export type ScreenshotViewTarget = {
  targetRotationDeg: number;
  targetScale: number;
  centerMapX: number;
  centerMapY: number;
};

export function ensureHomeImagesDir(): void {
  mkdirSync(HOME_IMAGES_DIR, { recursive: true });
}

export async function prepareOnlineRoomWithMap(
  page: Page,
  request: Parameters<typeof goToOnlineRoom>[1],
): Promise<string> {
  const roomId = await goToOnlineRoom(page, request);
  await uploadMapImage(page, SAMPLE_MAP_PATH);
  await waitForKonvaMapImage(page);
  await page.waitForTimeout(400);
  return roomId;
}

export async function getStageDimensions(page: Page): Promise<{ width: number; height: number }> {
  return page.evaluate(() => {
    const konva = (window as unknown as { Konva?: { stages: { width: () => number; height: () => number }[] } })
      .Konva;
    if (konva === undefined || konva.stages.length === 0) {
      throw new Error("Konva stage not found");
    }
    const stage = konva.stages[0];
    return { width: stage.width(), height: stage.height() };
  });
}

function normalizeAngleDelta(target: number, current: number): number {
  let delta = target - current;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

const ROUTE_JITTER_SEED = 0x52_4f55_54;

function distPointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const ab2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ab2));
  const qx = ax + t * (bx - ax);
  const qy = ay + t * (by - ay);
  return Math.hypot(px - qx, py - qy);
}

function maxDistanceToPolyline(
  path: readonly (readonly [number, number])[],
  polyline: readonly (readonly [number, number])[],
): number {
  let max = 0;
  for (const [px, py] of path) {
    let minToPoly = Infinity;
    for (let i = 0; i < polyline.length - 1; i += 1) {
      const [ax, ay] = polyline[i];
      const [bx, by] = polyline[i + 1];
      minToPoly = Math.min(minToPoly, distPointToSegment(px, py, ax, ay, bx, by));
    }
    max = Math.max(max, minToPoly);
  }
  return max;
}

function chaikinOpen(points: readonly [number, number][], iterations: number): [number, number][] {
  let pts = points.map((p) => [p[0], p[1]] as [number, number]);
  for (let iter = 0; iter < iterations; iter += 1) {
    const out: [number, number][] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      out.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
      out.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

function resamplePolyline(points: readonly [number, number][], stepPx: number): [number, number][] {
  if (points.length === 0) return [];
  if (points.length === 1) return [[points[0][0], points[0][1]]];
  const out: [number, number][] = [[points[0][0], points[0][1]]];
  let [cx, cy] = points[0];
  for (let i = 1; i < points.length; i += 1) {
    const [tx, ty] = points[i];
    let dx = tx - cx;
    let dy = ty - cy;
    let segLen = Math.hypot(dx, dy);
    while (segLen >= stepPx) {
      const t = stepPx / segLen;
      cx += dx * t;
      cy += dy * t;
      out.push([cx, cy]);
      dx = tx - cx;
      dy = ty - cy;
      segLen = Math.hypot(dx, dy);
    }
    cx = tx;
    cy = ty;
  }
  const last = points[points.length - 1];
  const prev = out[out.length - 1];
  if (Math.hypot(last[0] - prev[0], last[1] - prev[1]) > 0.5) {
    out.push([last[0], last[1]]);
  }
  return out;
}

function jitterHash(index: number, salt: number): number {
  let h = (index * 374761393 + salt * 668265263 + ROUTE_JITTER_SEED) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function addDeterministicJitter(
  points: readonly [number, number][],
  amplitude: number,
): [number, number][] {
  return points.map(([x, y], index) => {
    const a0 = jitterHash(index, 1) * 2 - 1;
    const a1 = jitterHash(index, 2) * 2 - 1;
    return [x + a0 * amplitude, y + a1 * amplitude];
  });
}

/** Chaikin-smooth polyline, resample ~6 map px, tiny jitter; asserts ≤25 px from control polyline. */
export function buildDrawPathFromWaypoints(
  waypoints: readonly (readonly [number, number])[],
): [number, number][] {
  const polyline = waypoints.map(([x, y]) => [x, y] as [number, number]);
  const smoothed = chaikinOpen(polyline, 2);
  const resampled = resamplePolyline(smoothed, 6);
  const overshoot = maxDistanceToPolyline(resampled, polyline);
  if (overshoot > 25) {
    throw new Error(`route path overshoots polyline by ${overshoot.toFixed(1)} map px (max 25)`);
  }
  return addDeterministicJitter(resampled, 1.5);
}

export async function viewportCornersOnMap(page: Page): Promise<boolean> {
  return page.evaluate(({ mapWidth, mapHeight }) => {
    const konva = (
      window as unknown as {
        Konva?: {
          stages: {
            width: () => number;
            height: () => number;
            getLayers: () => {
              getChildren: () => {
                getClassName?: () => string;
                getAbsoluteTransform: () => {
                  copy: () => {
                    invert: () => { point: (p: { x: number; y: number }) => { x: number; y: number } };
                  };
                };
              }[];
            }[];
          }[];
        };
      }
    ).Konva;
    if (!konva?.stages.length) return false;
    const stage = konva.stages[0];
    const stageW = stage.width();
    const stageH = stage.height();
    const viewGroup = stage.getLayers()[0]?.getChildren().find((n) => n.getClassName?.() === "Group");
    if (!viewGroup) return false;
    const inv = viewGroup.getAbsoluteTransform().copy().invert();
    const corners = [
      [0, 0],
      [stageW, 0],
      [stageW, stageH],
      [0, stageH],
    ] as const;
    for (const [sx, sy] of corners) {
      const mapPt = inv.point({ x: sx, y: sy });
      if (mapPt.x < 0 || mapPt.y < 0 || mapPt.x > mapWidth || mapPt.y > mapHeight) {
        return false;
      }
    }
    return true;
  }, { mapWidth: MAP.width, mapHeight: MAP.height });
}

export async function applyScreenshotViewMinimalScale(
  page: Page,
  target: ScreenshotViewTarget,
  scaleStart = 0.34,
  scaleMax = 1.55,
): Promise<void> {
  await rotateToDegrees(page, target.targetRotationDeg);
  const { width, height } = await getStageDimensions(page);
  let chosen: number | null = null;
  for (let scale = scaleStart; scale <= scaleMax + 0.001; scale += 0.012) {
    await zoomToScale(page, scale);
    await centerMapPoint(page, target.centerMapX, target.centerMapY, width, height);
    await centerMapPoint(page, target.centerMapX, target.centerMapY, width, height);
    await waitForViewSettled(page);
    if (await viewportCornersOnMap(page)) {
      chosen = scale;
      break;
    }
  }
  if (chosen === null) {
    throw new Error("no scale keeps viewport corners on map");
  }
  await zoomToScale(page, chosen);
  await centerMapPoint(page, target.centerMapX, target.centerMapY, width, height);
  await centerMapPoint(page, target.centerMapX, target.centerMapY, width, height);
  await waitForViewSettled(page);
  target.targetScale = chosen;
  await assertScreenshotView(page, target);
}

export async function assertViewSharingToolbarVisible(page: Page): Promise<void> {
  const follower = page.getByTestId("view-follwer");
  await expect(follower).toBeVisible();
  const box = await follower.boundingBox();
  expect(box, "view-follwer button has no layout box").not.toBeNull();
  const { height: stageH } = await getStageDimensions(page);
  expect(
    box!.y + box!.height,
    "view-follwer button bottom must be inside viewport",
  ).toBeLessThanOrEqual(stageH + 2);
}

export async function mapPointToPageCoords(
  page: Page,
  mapX: number,
  mapY: number,
): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ({ mx, my }) => {
      const konva = (
        window as unknown as {
          Konva?: {
            stages: {
              width: () => number;
              height: () => number;
              container: () => HTMLElement;
              getLayers: () => {
                getChildren: () => {
                  getClassName?: () => string;
                  getAbsoluteTransform: () => {
                    point: (p: { x: number; y: number }) => { x: number; y: number };
                  };
                }[];
              }[];
            }[];
          };
        }
      ).Konva;
      if (konva === undefined || konva.stages.length === 0) {
        throw new Error("Konva stage not found");
      }
      const stage = konva.stages[0];
      const layer = stage.getLayers()[0];
      const viewGroup = layer
        ?.getChildren()
        .find((node) => node.getClassName?.() === "Group");
      if (viewGroup === undefined) {
        throw new Error("Konva view group not found");
      }
      const stagePoint = viewGroup.getAbsoluteTransform().point({ x: mx, y: my });
      const rect = stage.container().getBoundingClientRect();
      const scaleX = rect.width / stage.width();
      const scaleY = rect.height / stage.height();
      return {
        x: rect.left + stagePoint.x * scaleX,
        y: rect.top + stagePoint.y * scaleY,
      };
    },
    { mx: mapX, my: mapY },
  );
}

export async function assertScreenshotView(
  page: Page,
  target: ScreenshotViewTarget,
): Promise<void> {
  const check = await page.evaluate(
    ({ targetRotationDeg, centerMapX, centerMapY, mapWidth, mapHeight }) => {
      const konva = (
        window as unknown as {
          Konva?: {
            stages: {
              width: () => number;
              height: () => number;
              getLayers: () => {
                getChildren: () => {
                  getClassName?: () => string;
                  rotation: () => number;
                  getAbsoluteTransform: () => {
                    copy: () => {
                      invert: () => {
                        point: (p: { x: number; y: number }) => { x: number; y: number };
                      };
                      point: (p: { x: number; y: number }) => { x: number; y: number };
                    };
                  };
                }[];
              }[];
            }[];
          };
        }
      ).Konva;
      if (konva === undefined || konva.stages.length === 0) {
        return { ok: false, reason: "no Konva stage" };
      }
      const stage = konva.stages[0];
      const stageW = stage.width();
      const stageH = stage.height();
      const layer = stage.getLayers()[0];
      const viewGroup = layer
        ?.getChildren()
        .find((node) => node.getClassName?.() === "Group");
      if (viewGroup === undefined) {
        return { ok: false, reason: "no view group" };
      }

      const rotation = viewGroup.rotation();
      let rotDelta = targetRotationDeg - rotation;
      while (rotDelta > 180) rotDelta -= 360;
      while (rotDelta < -180) rotDelta += 360;
      if (Math.abs(rotDelta) > 1) {
        return { ok: false, reason: `rotation ${rotation.toFixed(2)}° vs target ${targetRotationDeg}°` };
      }

      const abs = viewGroup.getAbsoluteTransform().copy();
      const centerStage = abs.point({ x: centerMapX, y: centerMapY });
      const centerErr = Math.hypot(centerStage.x - stageW / 2, centerStage.y - stageH / 2);
      if (centerErr > 20) {
        return {
          ok: false,
          reason: `map center offset ${centerErr.toFixed(1)}px on stage (target ${centerMapX},${centerMapY})`,
        };
      }

      const inv = abs.invert();
      const corners: [number, number][] = [
        [0, 0],
        [stageW, 0],
        [stageW, stageH],
        [0, stageH],
      ];
      for (const [sx, sy] of corners) {
        const mapPt = inv.point({ x: sx, y: sy });
        if (mapPt.x < 0 || mapPt.y < 0 || mapPt.x > mapWidth || mapPt.y > mapHeight) {
          return {
            ok: false,
            reason: `viewport corner (${sx},${sy}) maps outside map: (${mapPt.x.toFixed(0)},${mapPt.y.toFixed(0)})`,
          };
        }
      }

      return { ok: true as const, rotation };
    },
    {
      targetRotationDeg: target.targetRotationDeg,
      centerMapX: target.centerMapX,
      centerMapY: target.centerMapY,
      mapWidth: MAP.width,
      mapHeight: MAP.height,
    },
  );

  expect(check.ok, check.reason ?? "view assertion failed").toBe(true);
}

export async function applyScreenshotView(page: Page, target: ScreenshotViewTarget): Promise<void> {
  await rotateToDegrees(page, target.targetRotationDeg);
  let scale = target.targetScale;
  const { width, height } = await getStageDimensions(page);
  for (let attempt = 0; attempt < 25; attempt += 1) {
    await zoomToScale(page, scale);
    await centerMapPoint(page, target.centerMapX, target.centerMapY, width, height);
    await centerMapPoint(page, target.centerMapX, target.centerMapY, width, height);
    const check = await page.evaluate(
      ({ targetRotationDeg, centerMapX, centerMapY, mapWidth, mapHeight }) => {
        const konva = (
          window as unknown as {
            Konva?: {
              stages: {
                width: () => number;
                height: () => number;
                getLayers: () => {
                  getChildren: () => {
                    getClassName?: () => string;
                    rotation: () => number;
                    getAbsoluteTransform: () => {
                      copy: () => {
                        invert: () => { point: (p: { x: number; y: number }) => { x: number; y: number } };
                        point: (p: { x: number; y: number }) => { x: number; y: number };
                      };
                    };
                  }[];
                }[];
              }[];
            };
          }
        ).Konva;
        if (!konva?.stages.length) return { ok: false as const, reason: "no stage" };
        const stage = konva.stages[0];
        const stageW = stage.width();
        const stageH = stage.height();
        const layer = stage.getLayers()[0];
        const viewGroup = layer?.getChildren().find((n) => n.getClassName?.() === "Group");
        if (!viewGroup) return { ok: false as const, reason: "no group" };
        const rotation = viewGroup.rotation();
        let rotDelta = targetRotationDeg - rotation;
        while (rotDelta > 180) rotDelta -= 360;
        while (rotDelta < -180) rotDelta += 360;
        if (Math.abs(rotDelta) > 1) {
          return { ok: false as const, reason: `rotation ${rotation.toFixed(1)}°` };
        }
        const abs = viewGroup.getAbsoluteTransform().copy();
        const centerStage = abs.point({ x: centerMapX, y: centerMapY });
        if (Math.hypot(centerStage.x - stageW / 2, centerStage.y - stageH / 2) > 20) {
          return { ok: false as const, reason: "center off" };
        }
        const inv = abs.invert();
        const corners = [
          [0, 0],
          [stageW, 0],
          [stageW, stageH],
          [0, stageH],
        ] as const;
        for (const [sx, sy] of corners) {
          const mapPt = inv.point({ x: sx, y: sy });
          if (mapPt.x < 0 || mapPt.y < 0 || mapPt.x > mapWidth || mapPt.y > mapHeight) {
            return { ok: false as const, reason: "corner outside map" };
          }
        }
        return { ok: true as const };
      },
      {
        targetRotationDeg: target.targetRotationDeg,
        centerMapX: target.centerMapX,
        centerMapY: target.centerMapY,
        mapWidth: MAP.width,
        mapHeight: MAP.height,
      },
    );
    if (check.ok) {
      return;
    }
    scale += 0.04;
    if (scale > 1.75) {
      break;
    }
  }
  await assertScreenshotView(page, target);
}

export async function ensureMapPointsVisibleInViewport(
  page: Page,
  mapPoints: readonly (readonly [number, number])[],
): Promise<void> {
  const { width: stageW, height: stageH } = await getStageDimensions(page);
  const minXBound = TOOLBAR_GUTTER_PX;
  const maxXBound = stageW - 6;
  const minYBound = 6;
  const maxYBound = stageH - 6;

  let lastMinX = 0;
  let lastMaxX = 0;
  let lastMinY = 0;
  let lastMaxY = 0;
  for (let nudge = 0; nudge < 20; nudge += 1) {
    const viewportOrigin = await page.evaluate(() => {
      const konva = (window as unknown as { Konva?: { stages: { container: () => HTMLElement }[] } })
        .Konva;
      const stage = konva?.stages[0];
      if (!stage) return { left: 0, top: 0 };
      const rect = stage.container().getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    });
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [mx, my] of mapPoints) {
      const pt = await mapPointToPageCoords(page, mx, my);
      const localX = pt.x - viewportOrigin.left;
      const localY = pt.y - viewportOrigin.top;
      minX = Math.min(minX, localX);
      maxX = Math.max(maxX, localX);
      minY = Math.min(minY, localY);
      maxY = Math.max(maxY, localY);
    }
    lastMinX = minX;
    lastMaxX = maxX;
    lastMinY = minY;
    lastMaxY = maxY;

    const fits =
      minX >= minXBound - 2 &&
      maxX <= maxXBound + 2 &&
      minY >= minYBound - 2 &&
      maxY <= maxYBound + 2;
    if (fits) {
      return;
    }

    const spanX = maxX - minX;
    const spanY = maxY - minY;
    if (spanX > maxXBound - minXBound || spanY > maxYBound - minYBound) {
      await zoomWheel(page, -160, 2);
      await waitForViewSettled(page);
      continue;
    }

    let panX = 0;
    let panY = 0;
    if (minX < minXBound) panX = minXBound - minX + 5;
    else if (maxX > maxXBound) panX = maxXBound - maxX - 2;
    if (minY < minYBound) panY = minYBound - minY + 4;
    else if (maxY > maxYBound) panY = maxYBound - maxY - 2;
    await panByStageDelta(page, panX, panY);
  }
  throw new Error(
    `could not fit route waypoints in viewport (last bbox x:${lastMinX.toFixed(0)}..${lastMaxX.toFixed(0)} y:${lastMinY.toFixed(0)}..${lastMaxY.toFixed(0)} stage ${stageW}x${stageH})`,
  );
}

export async function assertRouteVisibleOnCanvas(
  page: Page,
  mapPoints: readonly (readonly [number, number])[],
): Promise<void> {
  const { width: stageW, height: stageH } = await getStageDimensions(page);
  const viewportOrigin = await page.evaluate(() => {
    const konva = (window as unknown as { Konva?: { stages: { container: () => HTMLElement }[] } })
      .Konva;
    const stage = konva?.stages[0];
    if (!stage) return { left: 0, top: 0 };
    const rect = stage.container().getBoundingClientRect();
    return { left: rect.left, top: rect.top };
  });
  for (const [mx, my] of mapPoints) {
    const pagePt = await mapPointToPageCoords(page, mx, my);
    const localX = pagePt.x - viewportOrigin.left;
    const localY = pagePt.y - viewportOrigin.top;
    expect(localX, `route map (${mx},${my}) under toolbar`).toBeGreaterThanOrEqual(
      TOOLBAR_GUTTER_PX - 2,
    );
    expect(localX, `route map (${mx},${my}) off canvas right`).toBeLessThanOrEqual(stageW + 8);
    expect(localY, `route map (${mx},${my}) off canvas top`).toBeGreaterThanOrEqual(-4);
    expect(localY, `route map (${mx},${my}) off canvas bottom`).toBeLessThanOrEqual(stageH + 8);
  }
  expect(await canvasHasRedStroke(page), "expected red stroke pixels on canvas").toBe(true);
}

export async function drawRouteOnMap(
  page: Page,
  waypoints: readonly (readonly [number, number])[],
): Promise<void> {
  await selectMode(page, "draw");
  const points = buildDrawPathFromWaypoints(waypoints);
  const first = await mapPointToPageCoords(page, points[0][0], points[0][1]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  await page.mouse.move(first.x + 1, first.y + 1, { steps: 2 });
  for (let i = 1; i < points.length; i += 1) {
    const p = await mapPointToPageCoords(page, points[i][0], points[i][1]);
    await page.mouse.move(p.x, p.y, { steps: 4 });
  }
  await page.mouse.up();
  await page.waitForTimeout(120);
  await assertRouteVisibleOnCanvas(page, waypoints);
}

export async function zoomWheel(page: Page, deltaY: number, repeat: number): Promise<void> {
  await selectMode(page, "move");
  const canvas = await waitForCanvas(page);
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error("canvas bounding box not found");
  }
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  for (let i = 0; i < repeat; i += 1) {
    await canvas.dispatchEvent("wheel", { deltaY, ctrlKey: false, bubbles: true });
  }
  await waitForViewSettled(page);
}

export async function rotateViewWheel(page: Page, deltaY: number, repeat: number): Promise<void> {
  await selectMode(page, "move");
  const canvas = await waitForCanvas(page);
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error("canvas bounding box not found");
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < repeat; i += 1) {
    await canvas.dispatchEvent("wheel", { deltaY, ctrlKey: true, bubbles: true });
  }
  await waitForViewSettled(page);
}

export async function zoomToScale(page: Page, targetScale: number): Promise<void> {
  await selectMode(page, "move");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const { scaleX } = await getKonvaViewGroupTransform(page);
    if (Math.abs(scaleX - targetScale) < 0.06) return;
    const ratio = targetScale / scaleX;
    const deltaY = ratio > 1 ? -160 : 160;
    await zoomWheel(page, deltaY, 1);
  }
}

export async function rotateToDegrees(page: Page, targetDeg: number): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const { rotation } = await getKonvaViewGroupTransform(page);
    const delta = normalizeAngleDelta(targetDeg, rotation);
    if (Math.abs(delta) < 0.6) return;
    const step = Math.max(-120, Math.min(120, delta / 0.02));
    await rotateViewWheel(page, step, 1);
  }
  const { rotation } = await getKonvaViewGroupTransform(page);
  throw new Error(`failed to reach rotation ${targetDeg}° (at ${rotation}°)`);
}

export async function panByStageDelta(page: Page, dx: number, dy: number): Promise<void> {
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
  await selectMode(page, "move");
  const canvas = await waitForCanvas(page);
  const box = await canvas.boundingBox();
  if (box === null) throw new Error("canvas bounding box not found");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 12 });
  await page.waitForTimeout(30);
  await page.mouse.up();
  await waitForViewSettled(page);
}

export async function centerMapPoint(
  page: Page,
  mapX: number,
  mapY: number,
  _stageWidth: number,
  _stageHeight: number,
): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const err = await page.evaluate(
      ({ mx, my }) => {
        const konva = (window as unknown as { Konva?: { stages: { width: () => number; height: () => number; getLayers: () => { getChildren: () => { getClassName?: () => string; getAbsoluteTransform: () => { point: (p: { x: number; y: number }) => { x: number; y: number } } }[] }[] }[] } }).Konva;
        if (!konva?.stages.length) return { dx: 0, dy: 0, err: 999 };
        const stage = konva.stages[0];
        const stageW = stage.width();
        const stageH = stage.height();
        const viewGroup = stage.getLayers()[0]?.getChildren().find((n) => n.getClassName?.() === "Group");
        if (!viewGroup) return { dx: 0, dy: 0, err: 999 };
        const pt = viewGroup.getAbsoluteTransform().point({ x: mx, y: my });
        const dx = stageW / 2 - pt.x;
        const dy = stageH / 2 - pt.y;
        return { dx, dy, err: Math.hypot(dx, dy) };
      },
      { mx: mapX, my: mapY },
    );
    if (err.err < 4) return;
    await panByStageDelta(page, err.dx, err.dy);
  }
}

export async function waitForViewSettled(page: Page, stableMs = 350): Promise<void> {
  let last = await getKonvaViewGroupTransform(page);
  let stableSince = Date.now();
  const deadline = Date.now() + 8_000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(50);
    const next = await getKonvaViewGroupTransform(page);
    const moved =
      Math.abs(next.x - last.x) > 0.5 ||
      Math.abs(next.y - last.y) > 0.5 ||
      Math.abs(next.scaleX - last.scaleX) > 0.01 ||
      Math.abs(next.rotation - last.rotation) > 0.05;
    if (moved) {
      last = next;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= stableMs) {
      return;
    }
  }
}

export async function settleForScreenshot(page: Page): Promise<void> {
  await waitForViewSettled(page);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.mouse.move(8, 8);
  await page.waitForTimeout(200);
}

export async function pngBufferToWebp(page: Page, pngBuffer: Buffer, quality = 0.85): Promise<Buffer> {
  const base64 = pngBuffer.toString("base64");
  const dataUrl = await page.evaluate(
    async ({ b64, q }) => {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("PNG decode failed"));
        img.src = `data:image/png;base64,${b64}`;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx === null) throw new Error("2d context unavailable");
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL("image/webp", q);
    },
    { b64: base64, q: quality },
  );
  const match = /^data:image\/webp;base64,(.+)$/.exec(dataUrl);
  if (match === null) {
    throw new Error("WebP encoding failed");
  }
  return Buffer.from(match[1], "base64");
}

export async function saveViewportWebp(
  page: Page,
  filename: string,
  quality = 0.85,
): Promise<{ path: string; bytes: number; width: number; height: number }> {
  ensureHomeImagesDir();
  await assertViewSharingToolbarVisible(page);
  await settleForScreenshot(page);
  const pngBuffer = await page.screenshot({ type: "png" });
  const webp = await pngBufferToWebp(page, pngBuffer, quality);
  const outPath = path.join(HOME_IMAGES_DIR, filename);
  writeFileSync(outPath, webp);
  const dims = await readWebpDimensions(page, webp);
  return { path: outPath, bytes: webp.length, width: dims.width, height: dims.height };
}

export async function readWebpDimensions(
  page: Page,
  webpBuffer: Buffer,
): Promise<{ width: number; height: number }> {
  const base64 = webpBuffer.toString("base64");
  return page.evaluate((b64) => {
    return new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("WebP decode failed"));
      img.src = `data:image/webp;base64,${b64}`;
    });
  }, base64);
}

export async function compositeSideBySideWebp(
  page: Page,
  leftPng: Buffer,
  rightPng: Buffer,
  filename: string,
  gutterPx = 8,
  quality = 0.85,
): Promise<{ path: string; bytes: number; width: number; height: number }> {
  const leftB64 = leftPng.toString("base64");
  const rightB64 = rightPng.toString("base64");
  const pngOut = await page.evaluate(
    async ({ leftB64, rightB64, gutterPx }) => {
      const load = (b64: string) =>
        new Promise<{ w: number; h: number; img: HTMLImageElement }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight, img });
          img.onerror = () => reject(new Error("image load failed"));
          img.src = `data:image/png;base64,${b64}`;
        });
      const left = await load(leftB64);
      const right = await load(rightB64);
      const width = left.w + gutterPx + right.w;
      const height = Math.max(left.h, right.h);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx === null) throw new Error("2d context unavailable");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(left.img, 0, 0);
      ctx.drawImage(right.img, left.w + gutterPx, 0);
      return canvas.toDataURL("image/png");
    },
    { leftB64, rightB64, gutterPx },
  );
  const pngMatch = /^data:image\/png;base64,(.+)$/.exec(pngOut);
  if (pngMatch === null) throw new Error("composite failed");
  const compositePng = Buffer.from(pngMatch[1], "base64");
  const webp = await pngBufferToWebp(page, compositePng, quality);
  ensureHomeImagesDir();
  const outPath = path.join(HOME_IMAGES_DIR, filename);
  writeFileSync(outPath, webp);
  const dims = await readWebpDimensions(page, webp);
  return { path: outPath, bytes: webp.length, width: dims.width, height: dims.height };
}

export async function selectViewModeForCapture(
  page: Page,
  mode: "single" | "leader" | "follwer",
): Promise<void> {
  const button = page.getByTestId(`view-${mode}`);
  await expect(button).toBeVisible();
  await button.scrollIntoViewIfNeeded();
  await button.click({ force: true });
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

export async function waitForFollowerView(
  pageLeader: Page,
  pageFollower: Page,
  timeoutMs = 60_000,
): Promise<void> {
  await pageLeader.waitForTimeout(800);
  await expect
    .poll(
      async () => {
        const a = await getKonvaViewGroupTransform(pageLeader);
        const b = await getKonvaViewGroupTransform(pageFollower);
        return (
          Math.abs(a.rotation - b.rotation) < 1.5 &&
          Math.abs(a.scaleX - b.scaleX) < 0.1 &&
          Math.abs(a.x - b.x) < 30 &&
          Math.abs(a.y - b.y) < 30
        );
      },
      { timeout: timeoutMs },
    )
    .toBe(true);
}

export async function savePngPreview(page: Page, webpPath: string, previewDir: string): Promise<string> {
  mkdirSync(previewDir, { recursive: true });
  const { readFileSync, writeFileSync } = await import("node:fs");
  const webpBuf = readFileSync(webpPath);
  const pngFromWebp = await webpToPng(page, webpBuf);
  const baseName = path.basename(webpPath, ".webp");
  const previewPath = path.join(previewDir, `${baseName}.png`);
  writeFileSync(previewPath, pngFromWebp);
  return previewPath;
}

async function webpToPng(page: Page, webpBuffer: Buffer): Promise<Buffer> {
  const base64 = webpBuffer.toString("base64");
  const dataUrl = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("webp decode failed"));
      img.src = `data:image/webp;base64,${b64}`;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("2d context unavailable");
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  }, base64);
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (match === null) throw new Error("PNG export failed");
  return Buffer.from(match[1], "base64");
}

export { webpToPng };
