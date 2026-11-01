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
  finalizeVideoBuffer,
  recordDrawEraseDemo,
  recordHeroDemo,
  recordRotateDemo,
  recordSharingMotion,
} from "./demo-scripts";
import {
  HERO_LEGS,
  LEG_1_2,
  LEG_7_FINISH_NORTH,
  LEG_7_FINISH_SOUTH,
  OPACITY_LEGS,
  SHARING_LEG,
  heroFramingCenter,
  lakeFramingPoints,
} from "./routes";
import {
  VIDEO_FPS,
  VideoFrameBuffer,
  captureViewportPng,
  compositeSideBySidePng,
  encodeWebmFromPngFrames,
  saveStillFromPng,
  saveVideoPreviewFrames,
  verifyWebmInChromium,
} from "./video-capture";

const PREVIEW_DIR = path.join(REPO_ROOT, "test-results", "home-screenshots-preview");
const VIDEO_PREVIEW_DIR = path.join(REPO_ROOT, "test-results", "home-screenshots-video-preview");

const FEATURE_VIEWPORT = { width: 1152, height: 864 } as const;
const HERO_VIEWPORT = { width: 1440, height: 900 } as const;
const SHARING_WIDTH = 1152 * 2 + 8;

const heroCenter = heroFramingCenter();
const HERO_VIEW = {
  targetRotationDeg: -8,
  targetScale: 0.5,
  centerMapX: heroCenter.x - 80,
  centerMapY: heroCenter.y + 20,
};

const ROTATE_VIEW = {
  targetRotationDeg: 34,
  targetScale: 0.92,
  centerMapX: 720,
  centerMapY: 490,
};

const LAKE_VIEW = {
  targetRotationDeg: -4,
  targetScale: 0.46,
  centerMapX: 1050,
  centerMapY: 980,
};

const OPACITY_VIEW = {
  targetRotationDeg: 6,
  targetScale: 0.72,
  centerMapX: 1280,
  centerMapY: 620,
};

const SHARING_VIEW = {
  targetRotationDeg: -12,
  targetScale: 0.78,
  centerMapX: 990,
  centerMapY: 780,
};

test.describe.configure({ mode: "serial" });

test("landing page WebP screenshots and WebM demos", async ({ browser, request }) => {
  test.setTimeout(1_200_000);
  mkdirSync(PREVIEW_DIR, { recursive: true });
  mkdirSync(VIDEO_PREVIEW_DIR, { recursive: true });

  {
    const context = await browser.newContext({ viewport: HERO_VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      await prepareOnlineRoomWithMap(page, request);
      await waitForKonvaMapImage(page);
      await applyScreenshotViewMinimalScale(page, HERO_VIEW);
      for (const leg of HERO_LEGS) {
        await ensureMapPointsVisibleInViewport(page, leg.waypoints);
        await drawRouteOnMap(page, leg.waypoints, leg.meta);
      }
      await selectMode(page, "move");
      await settleForScreenshot(page);
      const stillPng = await captureViewportPng(page);
      const heroStill = await saveStillFromPng(page, stillPng, "hero.webp", 0.82);
      await savePngPreview(page, heroStill.path, PREVIEW_DIR);

      await page.reload({ waitUntil: "domcontentloaded" });
      await prepareOnlineRoomWithMap(page, request);
      const videoBuf = new VideoFrameBuffer();
      await recordHeroDemo(page, videoBuf, HERO_VIEW, HERO_LEGS);
      const heroFrames = finalizeVideoBuffer(videoBuf, stillPng);
      const heroVid = await encodeWebmFromPngFrames(
        page,
        heroFrames,
        HERO_VIEWPORT.width,
        HERO_VIEWPORT.height,
        "hero.webm",
      );
      await verifyWebmInChromium(page, heroVid.path, HERO_VIEWPORT.width, HERO_VIEWPORT.height);
      await saveVideoPreviewFrames(heroFrames, VIDEO_PREVIEW_DIR, "hero");
    } finally {
      await context.close();
    }
  }

  {
    const context = await browser.newContext({ viewport: FEATURE_VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      await prepareOnlineRoomWithMap(page, request);
      const videoBuf = new VideoFrameBuffer();
      await recordRotateDemo(page, videoBuf, ROTATE_VIEW, LEG_1_2);
      await settleForScreenshot(page);
      const stillPng = await captureViewportPng(page);
      const still = await saveStillFromPng(page, stillPng, "rotate.webp");
      const frames = finalizeVideoBuffer(videoBuf, stillPng);
      const vid = await encodeWebmFromPngFrames(
        page,
        frames,
        FEATURE_VIEWPORT.width,
        FEATURE_VIEWPORT.height,
        "rotate.webm",
      );
      await verifyWebmInChromium(page, vid.path, FEATURE_VIEWPORT.width, FEATURE_VIEWPORT.height);
      await savePngPreview(page, still.path, PREVIEW_DIR);
      await saveVideoPreviewFrames(frames, VIDEO_PREVIEW_DIR, "rotate");
    } finally {
      await context.close();
    }
  }

  {
    const context = await browser.newContext({ viewport: FEATURE_VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      await prepareOnlineRoomWithMap(page, request);
      await applyScreenshotView(page, LAKE_VIEW);
      await ensureMapPointsVisibleInViewport(page, lakeFramingPoints());
      await drawRouteOnMap(page, LEG_7_FINISH_NORTH.waypoints, LEG_7_FINISH_NORTH.meta);
      await drawRouteOnMap(page, LEG_7_FINISH_SOUTH.waypoints, LEG_7_FINISH_SOUTH.meta);
      await selectMode(page, "draw");
      await settleForScreenshot(page);
      const stillPng = await captureViewportPng(page);
      const still = await saveStillFromPng(page, stillPng, "draw-erase.webp");
      await savePngPreview(page, still.path, PREVIEW_DIR);

      await page.reload({ waitUntil: "domcontentloaded" });
      await prepareOnlineRoomWithMap(page, request);
      await applyScreenshotView(page, LAKE_VIEW);
      const videoBuf = new VideoFrameBuffer();
      await recordDrawEraseDemo(page, videoBuf, LEG_7_FINISH_NORTH, LEG_7_FINISH_SOUTH);
      const frames = finalizeVideoBuffer(videoBuf, stillPng);
      const vid = await encodeWebmFromPngFrames(
        page,
        frames,
        FEATURE_VIEWPORT.width,
        FEATURE_VIEWPORT.height,
        "draw-erase.webm",
      );
      await verifyWebmInChromium(page, vid.path, FEATURE_VIEWPORT.width, FEATURE_VIEWPORT.height);
      await saveVideoPreviewFrames(frames, VIDEO_PREVIEW_DIR, "draw-erase");
    } finally {
      await context.close();
    }
  }

  {
    const context = await browser.newContext({ viewport: FEATURE_VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();
    try {
      await prepareOnlineRoomWithMap(page, request);
      await applyScreenshotView(page, OPACITY_VIEW);
      await ensureMapPointsVisibleInViewport(page, OPACITY_LEGS.flatMap((l) => [...l.waypoints]));
      for (const leg of OPACITY_LEGS) {
        await drawRouteOnMap(page, leg.waypoints, leg.meta);
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
      await drawRouteOnMap(pageA, SHARING_LEG.waypoints, SHARING_LEG.meta);
      await waitForFollowerView(pageA, pageB);
      const videoBuf = new VideoFrameBuffer();
      await recordSharingMotion(pageA, pageB, videoBuf, SHARING_VIEW, 24);
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
      const stillComposite = await compositeSideBySidePng(pageB, leftPng, rightPng);
      const frames = finalizeVideoBuffer(videoBuf, stillComposite);
      const vid = await encodeWebmFromPngFrames(
        pageB,
        frames,
        SHARING_WIDTH,
        FEATURE_VIEWPORT.height,
        "view-sharing.webm",
      );
      await verifyWebmInChromium(pageB, vid.path, SHARING_WIDTH, FEATURE_VIEWPORT.height);
      await saveVideoPreviewFrames(frames, VIDEO_PREVIEW_DIR, "view-sharing");
    } finally {
      await contextA.close();
      await contextB.close();
    }
  }
});
