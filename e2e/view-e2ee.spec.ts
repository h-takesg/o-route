import { test, expect } from "@playwright/test";
import {
  closeSharedOnlineClients,
  createOnlineRoom,
  drawStrokeOnCanvas,
  expectKonvaViewGroupTransformFinite,
  getKonvaViewGroupRotation,
  getRawRoomView,
  joinSharedOnlineRoom,
  openOnlineRoom,
  openSharedOnlineRoom,
  rotateViewCtrlWheel,
  selectMode,
  selectViewMode,
  waitForRedStroke,
} from "./helpers";

test.describe("view sharing E2EE", () => {
  test("raw view at rest has encrypted payload only", async ({ browser, request }) => {
    const clients = await openSharedOnlineRoom(browser, request);
    try {
      await joinSharedOnlineRoom(clients);
      const { pageA, roomId } = clients;

      await selectViewMode(pageA, "leader");
      await rotateViewCtrlWheel(pageA, 120, 12);

      await expect
        .poll(async () => {
          const view = await getRawRoomView(request, roomId);
          if (view === null) return false;
          const id = view.id;
          const payload = view.payload;
          if (typeof id !== "string" || id.length === 0) return false;
          if (typeof payload !== "string" || !payload.startsWith("1.")) return false;
          return true;
        })
        .toBe(true);

      const view = await getRawRoomView(request, roomId);
      expect(view).not.toBeNull();
      expect(view).not.toHaveProperty("center");
      expect(view).not.toHaveProperty("area");
      expect(view).not.toHaveProperty("rotation");
    } finally {
      await closeSharedOnlineClients(clients);
    }
  });

  test("second leader demotes first; new leader rotation is followed", async ({
    browser,
    request,
  }) => {
    const clients = await openSharedOnlineRoom(browser, request);
    try {
      await joinSharedOnlineRoom(clients);
      const { pageA, pageB, roomId } = clients;

      await selectViewMode(pageA, "leader");
      await pageB.getByTestId("view-leader").click({ timeout: 30_000 });

      await expect
        .poll(async () => {
          const aFollowerPressed = await pageA
            .getByTestId("view-follwer")
            .getAttribute("aria-pressed");
          const bLeaderPressed = await pageB
            .getByTestId("view-leader")
            .getAttribute("aria-pressed");
          return aFollowerPressed === "true" && bLeaderPressed === "true";
        }, { timeout: 30_000 })
        .toBe(true);

      await expect
        .poll(async () => {
          const view = await getRawRoomView(request, roomId);
          const payload = view?.payload;
          return typeof payload === "string" && payload.startsWith("1.");
        }, { timeout: 15_000 })
        .toBe(true);

      const initialRotationA = await getKonvaViewGroupRotation(pageA);

      await rotateViewCtrlWheel(pageB, 120, 12);

      await expect
        .poll(async () => {
          const rotationA = await getKonvaViewGroupRotation(pageA);
          const rotationB = await getKonvaViewGroupRotation(pageB);
          const followedLeader =
            Math.abs(rotationA - rotationB) < 0.08 && Math.abs(rotationB) > 0.15;
          const movedFromInitial = Math.abs(rotationA - initialRotationA) > 0.15;
          return followedLeader && movedFromInitial;
        }, { timeout: 30_000 })
        .toBe(true);
    } finally {
      await closeSharedOnlineClients(clients);
    }
  });

  test("follower without leader keeps finite view and canvas usable", async ({
    browser,
    request,
  }) => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await context.newPage();
    try {
      const roomId = await createOnlineRoom(request);
      await openOnlineRoom(page, roomId);

      await selectViewMode(page, "follwer");
      await expectKonvaViewGroupTransformFinite(page);

      await selectViewMode(page, "single");
      await selectMode(page, "draw");
      await drawStrokeOnCanvas(page);
      await waitForRedStroke(page);
    } finally {
      await context.close();
    }
  });
});
