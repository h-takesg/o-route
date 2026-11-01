import { mkdirSync } from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import {
  createOnlineRoom,
  openOnlineRoom,
  selectMode,
  uploadMapImage,
  waitForKonvaMapImage,
} from "../../e2e/helpers";
import {
  MAP,
  REPO_ROOT,
  SAMPLE_MAP_PATH,
  applyScreenshotView,
  applyScreenshotViewMinimalScale,
  assertViewSharingToolbarVisible,
  compositeSideBySideWebp,
  drawRouteOnMap,
  ensureMapPointsVisibleInViewport,
  prepareOnlineRoomWithMap,
  savePngPreview,
  saveViewportWebp,
  selectViewModeForCapture,
  settleForScreenshot,
  waitForFollowerView,
} from "./capture-utils";
import {
  HERO_LEGS,
  LEG_1_2,
  LEG_2_3,
  LEG_7_FINISH_EAST,
  LEG_7_FINISH_WEST,
  OPACITY_LEGS,
  heroFramingCenter,
} from "./routes";

const PREVIEW_DIR = path.join(REPO_ROOT, "test-results", "home-screenshots-preview");

const FEATURE_VIEWPORT = { width: 1152, height: 864 } as const;

const heroCenter = heroFramingCenter();
const HERO_VIEW = {
  targetRotationDeg: -8,
  targetScale: 0.5,
  centerMapX: heroCenter.x - 95,
  centerMapY: heroCenter.y + 25,
};

const ROTATE_VIEW = {
  targetRotationDeg: 36,
  targetScale: 1.05,
  centerMapX: 740,
  centerMapY: 455,
};

const LAKE_VIEW = {
  targetRotationDeg: -5,
  targetScale: 0.68,
  centerMapX: 1360,
  centerMapY: 1080,
};

const OPACITY_VIEW = {
  targetRotationDeg: 8,
  targetScale: 0.95,
  centerMapX: 980,
  centerMapY: 880,
};

const SHARING_VIEW = {
  targetRotationDeg: -14,
  targetScale: 0.82,
  centerMapX: 960,
  centerMapY: 720,
};

/** Short shared route for view-sharing demo (controls 1 → 3). */
const SHARING_ROUTE = [LEG_2_3[0], LEG_2_3[1], LEG_2_3[2], LEG_2_3[3]] as const;

test.describe.configure({ mode: "serial" });

test("landing page WebP screenshots", async ({ browser, request }) => {
  test.setTimeout(540_000);
  mkdirSync(PREVIEW_DIR, { recursive: true });

  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    try {
      await prepareOnlineRoomWithMap(page, request);
      await applyScreenshotViewMinimalScale(page, HERO_VIEW);
      for (const leg of HERO_LEGS) {
        await ensureMapPointsVisibleInViewport(page, leg);
        await drawRouteOnMap(page, leg);
      }
      await selectMode(page, "move");
      const hero = await saveViewportWebp(page, "hero.webp", 0.82);
      await savePngPreview(page, hero.path, PREVIEW_DIR);
    } finally {
      await context.close();
    }
  }

  {
    const context = await browser.newContext({
      viewport: FEATURE_VIEWPORT,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    try {
      await prepareOnlineRoomWithMap(page, request);
      await applyScreenshotView(page, ROTATE_VIEW);
      await ensureMapPointsVisibleInViewport(page, LEG_1_2);
      await drawRouteOnMap(page, LEG_1_2);
      await selectMode(page, "move");
      const rotate = await saveViewportWebp(page, "rotate.webp");
      await savePngPreview(page, rotate.path, PREVIEW_DIR);
    } finally {
      await context.close();
    }
  }

  {
    const context = await browser.newContext({
      viewport: FEATURE_VIEWPORT,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    try {
      await prepareOnlineRoomWithMap(page, request);
      await applyScreenshotView(page, LAKE_VIEW);
      const lakePoints = [...LEG_7_FINISH_WEST, ...LEG_7_FINISH_EAST, MAP.controls[6], MAP.finish];
      await ensureMapPointsVisibleInViewport(page, lakePoints);
      await drawRouteOnMap(page, LEG_7_FINISH_WEST);
      await drawRouteOnMap(page, LEG_7_FINISH_EAST);
      await selectMode(page, "draw");
      const drawErase = await saveViewportWebp(page, "draw-erase.webp");
      await savePngPreview(page, drawErase.path, PREVIEW_DIR);
    } finally {
      await context.close();
    }
  }

  {
    const context = await browser.newContext({
      viewport: FEATURE_VIEWPORT,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    try {
      await prepareOnlineRoomWithMap(page, request);
      await applyScreenshotView(page, OPACITY_VIEW);
      const opacityPoints = OPACITY_LEGS.flat();
      await ensureMapPointsVisibleInViewport(page, opacityPoints);
      for (const leg of OPACITY_LEGS) {
        await drawRouteOnMap(page, leg);
      }
      await page.getByTestId("opacity-translucent").click();
      await page.waitForTimeout(150);
      await selectMode(page, "move");
      const opacity = await saveViewportWebp(page, "opacity.webp");
      await savePngPreview(page, opacity.path, PREVIEW_DIR);
    } finally {
      await context.close();
    }
  }

  {
    const roomId = await createOnlineRoom(request);
    const contextOptions = { viewport: FEATURE_VIEWPORT, deviceScaleFactor: 1 };
    const contextA = await browser.newContext(contextOptions);
    const contextB = await browser.newContext(contextOptions);
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      await openOnlineRoom(pageA, roomId);
      await openOnlineRoom(pageB, roomId);
      await uploadMapImage(pageA, SAMPLE_MAP_PATH);
      await waitForKonvaMapImage(pageA);
      await waitForKonvaMapImage(pageB);

      await selectViewModeForCapture(pageA, "leader");
      await selectViewModeForCapture(pageB, "follwer");
      await applyScreenshotView(pageA, SHARING_VIEW);
      await drawRouteOnMap(pageA, SHARING_ROUTE);
      await waitForFollowerView(pageA, pageB);

      await selectMode(pageA, "move");
      await selectMode(pageB, "move");
      await assertViewSharingToolbarVisible(pageA);
      await assertViewSharingToolbarVisible(pageB);
      await settleForScreenshot(pageA);
      await settleForScreenshot(pageB);
      const leftPng = await pageA.screenshot({ type: "png" });
      const rightPng = await pageB.screenshot({ type: "png" });

      const composite = await compositeSideBySideWebp(pageB, leftPng, rightPng, "view-sharing.webp");
      await savePngPreview(pageB, composite.path, PREVIEW_DIR);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  }
});
