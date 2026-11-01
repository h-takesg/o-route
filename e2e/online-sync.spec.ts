import { test, expect } from "@playwright/test";
import {
  TINY_MAP_IMAGE_PATH,
  beginStrokeOnCanvas,
  canvasHasRedStroke,
  clickClearAll,
  closeSharedOnlineClients,
  drawStrokeOnCanvas,
  drawStrokeOnCanvasAt,
  endStrokeOnCanvas,
  getCanvasLinePointCounts,
  getKonvaViewGroupRotation,
  getRoomLineCount,
  joinSharedOnlineRoom,
  moveStrokeOnCanvas,
  openSharedOnlineRoom,
  rotateViewCtrlWheel,
  selectMode,
  selectViewMode,
  uploadMapImage,
  waitForKonvaMapImage,
  waitForNoRedStroke,
  waitForRedStroke,
  waitForCanvasLinesSnapshot,
  waitForRoomLinesSnapshot,
} from "./helpers";

test.describe("online sync (multi-client baseline)", () => {
  test("client B sees a stroke drawn by client A", async ({ browser, request }) => {
    const clients = await openSharedOnlineRoom(browser, request);
    try {
      await joinSharedOnlineRoom(clients);
      const { pageA, pageB } = clients;

      await selectMode(pageA, "draw");
      await drawStrokeOnCanvas(pageA);
      await waitForRedStroke(pageA);

      await expect.poll(() => canvasHasRedStroke(pageB)).toBe(true);
    } finally {
      await closeSharedOnlineClients(clients);
    }
  });

  test("client B joining mid-draw eventually sees the line after A finishes", async ({
    browser,
    request,
  }) => {
    const clients = await openSharedOnlineRoom(browser, request);
    try {
      const { pageA, pageB, roomId } = clients;

      await selectMode(pageA, "draw");
      await beginStrokeOnCanvas(pageA);
      await moveStrokeOnCanvas(pageA, { endXRatio: 0.52 }, 4);

      await joinSharedOnlineRoom(clients);

      await moveStrokeOnCanvas(pageA, { endXRatio: 0.65 }, 8);
      await endStrokeOnCanvas(pageA);

      await waitForRoomLinesSnapshot(request, roomId, {
        lineCount: 1,
        minPointCount: 6,
      });
      await waitForRedStroke(pageB);
    } finally {
      await closeSharedOnlineClients(clients);
    }
  });

  test("late join does not duplicate points while line is still drawing", async ({
    browser,
    request,
  }) => {
      const clients = await openSharedOnlineRoom(browser, request);
      try {
        const { pageA, pageB, roomId } = clients;

        await selectMode(pageA, "draw");
        await beginStrokeOnCanvas(pageA);
        await moveStrokeOnCanvas(pageA, { endXRatio: 0.55 }, 6);

        await joinSharedOnlineRoom(clients);

        await moveStrokeOnCanvas(pageA, { endXRatio: 0.7 }, 8);
        await endStrokeOnCanvas(pageA);

        const dbSnapshot = await waitForRoomLinesSnapshot(request, roomId, {
          lineCount: 1,
          minPointCount: 6,
        });
        const dbPointCount = dbSnapshot.lines[0]?.pointCount ?? 0;

        await expect.poll(async () => {
          const canvasCounts = await getCanvasLinePointCounts(pageB);
          return canvasCounts[0] ?? 0;
        }).toBe(dbPointCount);
      } finally {
        await closeSharedOnlineClients(clients);
      }
    });

  test("client B joining after two finished strokes matches decrypted DB points", async ({
    browser,
    request,
  }) => {
    const clients = await openSharedOnlineRoom(browser, request);
    try {
      const { pageA, pageB, roomId } = clients;

      await selectMode(pageA, "draw");
      await drawStrokeOnCanvasAt(pageA, 0.35, 0.4, 0.65, 0.4);
      await drawStrokeOnCanvasAt(pageA, 0.3, 0.65, 0.7, 0.65);

      const dbSnapshot = await waitForRoomLinesSnapshot(request, roomId, {
        lineCount: 2,
        minPointCount: 6,
      });

      await joinSharedOnlineRoom(clients);
      await waitForCanvasLinesSnapshot(pageB, dbSnapshot);
    } finally {
      await closeSharedOnlineClients(clients);
    }
  });

  test("client B no longer sees a line after A erases it", async ({ browser, request }) => {
    const clients = await openSharedOnlineRoom(browser, request);
    try {
      await joinSharedOnlineRoom(clients);
      const { pageA, pageB, roomId } = clients;

      await selectMode(pageA, "draw");
      await drawStrokeOnCanvas(pageA);
      await waitForRedStroke(pageB);

      await selectMode(pageA, "erase");
      await drawStrokeOnCanvas(pageA);

      await waitForNoRedStroke(pageB);
      await expect.poll(() => getRoomLineCount(request, roomId)).toBe(0);
    } finally {
      await closeSharedOnlineClients(clients);
    }
  });

  test("clear-all on A clears canvas for B and empties DB lines", async ({
    browser,
    request,
  }) => {
    const clients = await openSharedOnlineRoom(browser, request);
    try {
      await joinSharedOnlineRoom(clients);
      const { pageA, pageB, roomId } = clients;

      await selectMode(pageA, "draw");
      await drawStrokeOnCanvas(pageA);
      await waitForRedStroke(pageB);

      await clickClearAll(pageA);

      await waitForNoRedStroke(pageB);
      await expect.poll(() => getRoomLineCount(request, roomId)).toBe(0);
    } finally {
      await closeSharedOnlineClients(clients);
    }
  });

  test("map image uploaded by A appears on B via Konva Image node", async ({
    browser,
    request,
  }) => {
    const clients = await openSharedOnlineRoom(browser, request);
    try {
      await joinSharedOnlineRoom(clients);
      const { pageA, pageB } = clients;

      await uploadMapImage(pageA, TINY_MAP_IMAGE_PATH);
      await waitForKonvaMapImage(pageA);
      await waitForKonvaMapImage(pageB);
    } finally {
      await closeSharedOnlineClients(clients);
    }
  });

  test("view sharing: follower B follows leader A rotation", async ({ browser, request }) => {
    const clients = await openSharedOnlineRoom(browser, request);
    try {
      await joinSharedOnlineRoom(clients);
      const { pageA, pageB } = clients;

      await selectViewMode(pageA, "leader");
      await selectViewMode(pageB, "follwer");

      const initialRotationB = await getKonvaViewGroupRotation(pageB);

      await rotateViewCtrlWheel(pageA, 120, 12);

      await expect
        .poll(async () => {
          const rotationA = await getKonvaViewGroupRotation(pageA);
          const rotationB = await getKonvaViewGroupRotation(pageB);
          const followedLeader =
            Math.abs(rotationA - rotationB) < 0.08 && Math.abs(rotationA) > 0.15;
          const movedFromInitial = Math.abs(rotationB - initialRotationB) > 0.15;
          return followedLeader && movedFromInitial;
        })
        .toBe(true);
    } finally {
      await closeSharedOnlineClients(clients);
    }
  });
});
