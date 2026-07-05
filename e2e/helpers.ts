import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

const EMULATOR_DATABASE_HOST = "http://127.0.0.1:9000";
const EMULATOR_DATABASE_NS = "o-route-default-rtdb";

function emulatorDatabasePath(path: string): string {
  return `${EMULATOR_DATABASE_HOST}${path}?ns=${EMULATOR_DATABASE_NS}`;
}

export type RoomLineSnapshot = {
  isDrawing: boolean;
  pointCount: number;
  points: number[];
};

export type RoomLinesSnapshot = {
  lineCount: number;
  lines: RoomLineSnapshot[];
};

function normalizePoints(points: unknown): number[] {
  if (Array.isArray(points)) return points;
  if (typeof points === "object" && points !== null) {
    const record = points as Record<string, number>;
    return Object.keys(record)
      .map(Number)
      .sort((a, b) => a - b)
      .map((index) => record[String(index)]);
  }
  return [];
}

export async function waitForCanvas(page: Page): Promise<Locator> {
  const stage = page.getByTestId("canvas-stage");
  await expect(stage).toBeVisible({ timeout: 30_000 });
  const canvas = stage.locator("canvas").first();
  await expect(canvas).toBeVisible();
  return canvas;
}

export async function goToLocalMode(page: Page): Promise<void> {
  await page.goto("/local");
  await waitForCanvas(page);
}

export async function createOnlineRoom(
  request: APIRequestContext,
): Promise<string> {
  const response = await request.post(emulatorDatabasePath("/rooms.json"), {
    data: {
      image: "",
      lines: {},
      timestamp: Date.now(),
    },
  });
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as { name: string };
  return body.name;
}

export async function goToOnlineRoom(
  page: Page,
  request: APIRequestContext,
): Promise<string> {
  const roomId = await createOnlineRoom(request);
  await page.goto(`/online?roomId=${roomId}`);
  await page.waitForURL(new RegExp(`/online\\?roomId=${roomId}`));
  await waitForCanvas(page);
  return roomId;
}

export async function openOnlineRoom(
  page: Page,
  roomId: string,
): Promise<void> {
  await page.goto(`/online?roomId=${roomId}`);
  await page.waitForURL(new RegExp(`/online\\?roomId=${roomId}`));
  await waitForCanvas(page);
}

export async function selectMode(
  page: Page,
  mode: "move" | "draw" | "erase",
): Promise<void> {
  const button = page.getByTestId(`mode-${mode}`);
  await expect(button).toBeVisible();
  await button.click({ timeout: 30_000 });
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

export async function drawStrokeOnCanvas(page: Page): Promise<void> {
  await drawStrokeOnCanvasAt(page, 0.4, 0.5, 0.6, 0.5);
}

export async function drawStrokeOnCanvasAt(
  page: Page,
  startXRatio: number,
  startYRatio: number,
  endXRatio: number,
  endYRatio: number,
): Promise<void> {
  const canvas = await waitForCanvas(page);
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error("canvas bounding box not found");
  }

  const start = {
    x: box.x + box.width * startXRatio,
    y: box.y + box.height * startYRatio,
  };
  const end = {
    x: box.x + box.width * endXRatio,
    y: box.y + box.height * endYRatio,
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 12 });
  await page.mouse.up();
}

export async function canvasHasImageContent(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.querySelector(
      '[data-testid="canvas-stage"] canvas',
    );
    if (!(canvas instanceof HTMLCanvasElement)) return false;

    const context = canvas.getContext("2d");
    if (context === null) return false;

    const { width, height } = canvas;
    if (width === 0 || height === 0) return false;

    const imageData = context.getImageData(0, 0, width, height).data;
    const samples = new Set<number>();
    for (let i = 0; i < imageData.length; i += 400) {
      samples.add(imageData[i]);
    }
    return samples.size > 3;
  });
}

export async function canvasHasRedStroke(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvases = document.querySelectorAll(
      '[data-testid="canvas-stage"] canvas',
    );

    for (const canvas of canvases) {
      if (!(canvas instanceof HTMLCanvasElement)) continue;
      const context = canvas.getContext("2d");
      if (context === null) continue;

      const { width, height } = canvas;
      if (width === 0 || height === 0) continue;

      const imageData = context.getImageData(0, 0, width, height).data;
      for (let i = 0; i < imageData.length; i += 4) {
        const red = imageData[i];
        const green = imageData[i + 1];
        const blue = imageData[i + 2];
        const alpha = imageData[i + 3];
        if (alpha > 0 && red > 200 && green < 80 && blue < 80) {
          return true;
        }
      }
    }

    return false;
  });
}

export async function getCanvasLinePointCounts(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const konva = (
      window as unknown as {
        Konva?: { stages: { find: (selector: string) => { points: () => number[] }[] }[] };
      }
    ).Konva;
    if (konva === undefined || konva.stages.length === 0) return [];

    const lineNodes = konva.stages[0].find("Line");
    return lineNodes
      .map((line) => line.points().length)
      .filter((count) => count > 0)
      .sort((a, b) => a - b);
  });
}

export async function waitForCanvasLinesSnapshot(
  page: Page,
  expected: RoomLinesSnapshot,
): Promise<void> {
  const expectedCounts = expected.lines.map((line) => line.pointCount).sort((a, b) => a - b);

  await expect
    .poll(async () => {
      const counts = await getCanvasLinePointCounts(page);
      return JSON.stringify(counts) === JSON.stringify(expectedCounts);
    })
    .toBe(true);
}

export async function getRoomLinesSnapshot(
  request: APIRequestContext,
  roomId: string,
): Promise<RoomLinesSnapshot> {
  const response = await request.get(emulatorDatabasePath(`/rooms/${roomId}/lines.json`));
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as Record<
    string,
    { points?: unknown; isDrawing?: boolean; timestamp?: number }
  > | null;

  if (body === null) {
    return { lineCount: 0, lines: [] };
  }

  const lines = Object.entries(body)
    .map(([, value]) => {
      const points = normalizePoints(value.points);
      return {
        isDrawing: value.isDrawing === true,
        pointCount: points.length,
        points,
      };
    })
    .sort((a, b) => {
      if (a.pointCount !== b.pointCount) return a.pointCount - b.pointCount;
      return a.points[0] - b.points[0];
    });

  return {
    lineCount: lines.length,
    lines,
  };
}

export async function waitForRoomLinesSnapshot(
  request: APIRequestContext,
  roomId: string,
  expected: { lineCount: number; minPointCount: number; allFinished?: boolean },
): Promise<RoomLinesSnapshot> {
  let snapshot: RoomLinesSnapshot = { lineCount: 0, lines: [] };

  await expect
    .poll(async () => {
      snapshot = await getRoomLinesSnapshot(request, roomId);
      if (snapshot.lineCount !== expected.lineCount) return false;
      if (snapshot.lines.some((line) => line.pointCount < expected.minPointCount)) {
        return false;
      }
      if (expected.allFinished !== false && snapshot.lines.some((line) => line.isDrawing)) {
        return false;
      }
      return true;
    })
    .toBe(true);

  return snapshot;
}

export async function getRoomLineCount(
  request: APIRequestContext,
  roomId: string,
): Promise<number> {
  const snapshot = await getRoomLinesSnapshot(request, roomId);
  return snapshot.lineCount;
}

export async function getFirstRoomLinePointCount(
  request: APIRequestContext,
  roomId: string,
): Promise<number> {
  const snapshot = await getRoomLinesSnapshot(request, roomId);
  return snapshot.lines[0]?.pointCount ?? 0;
}
