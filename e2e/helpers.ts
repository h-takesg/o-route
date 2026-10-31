import {
  expect,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRoomKeyHash,
  createRoomKeyCheck,
  decryptBinary,
  decryptJson,
  decryptNumbers,
  exportRoomKey,
  generateRoomKey,
  IMAGE_META_PURPOSE,
  imageBlobPurpose,
  importRoomKey,
  linePurpose,
  parseRoomKeyFromHash,
} from "../src/crypto/roomCrypto";

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
export const E2E_FIXTURES_DIR = path.join(e2eDir, "fixtures");
export const TINY_MAP_IMAGE_PATH = path.join(E2E_FIXTURES_DIR, "tiny-red.png");

const EMULATOR_DATABASE_HOST = "http://127.0.0.1:9000";
const EMULATOR_DATABASE_NS = "o-route-default-rtdb";
const EMULATOR_STORAGE_HOST = "http://127.0.0.1:9199";
const STORAGE_BUCKET = "o-route.appspot.com";

const roomKeyHashes = new Map<string, string>();

function emulatorDatabasePath(dbPath: string): string {
  return `${EMULATOR_DATABASE_HOST}${dbPath}?ns=${EMULATOR_DATABASE_NS}`;
}

export { emulatorDatabasePath };

export type RoomLineSnapshot = {
  isDrawing: boolean;
  pointCount: number;
  points: number[];
};

export type RoomLinesSnapshot = {
  lineCount: number;
  lines: RoomLineSnapshot[];
};

type RawLineRecord = {
  points?: unknown;
  isDrawing?: boolean;
  timestamp?: number;
  chunks?: unknown;
};

type RawRoomLines = Record<string, RawLineRecord> | null;

function chunkEntries(chunks: unknown): { index: number; envelope: unknown }[] {
  if (typeof chunks !== "object" || chunks === null) return [];
  if (Array.isArray(chunks)) {
    return chunks.map((envelope, index) => ({ index, envelope }));
  }
  const record = chunks as Record<string, unknown>;
  return Object.keys(record)
    .map(Number)
    .filter((index) => Number.isInteger(index) && index >= 0)
    .sort((a, b) => a - b)
    .map((index) => ({ index, envelope: record[String(index)] }));
}

function linePayloadHasIllegalNumbers(value: unknown, allowTimestamp: boolean): boolean {
  if (typeof value === "number") {
    return !allowTimestamp;
  }
  if (Array.isArray(value)) {
    return value.some((entry) => linePayloadHasIllegalNumbers(entry, false));
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).some(([key, entry]) => {
      const childAllowsTimestamp = allowTimestamp && key === "timestamp";
      return linePayloadHasIllegalNumbers(entry, childAllowsTimestamp);
    });
  }
  return false;
}

async function roomKeyForId(roomId: string): Promise<CryptoKey> {
  const encodedKey = parseRoomKeyFromHash(getRoomKeyHash(roomId));
  if (encodedKey === null) {
    throw new Error(`no room key registered for roomId ${roomId}`);
  }
  return importRoomKey(encodedKey);
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

export function getRoomKeyHash(roomId: string): string {
  const hash = roomKeyHashes.get(roomId);
  if (hash === undefined) {
    throw new Error(`no room key hash registered for roomId ${roomId}`);
  }
  return hash;
}

export function roomUrl(roomId: string): string {
  return `/online?roomId=${roomId}${getRoomKeyHash(roomId)}`;
}

export function onlineRoomUrlWithoutKey(roomId: string): string {
  return `/online?roomId=${roomId}`;
}

export async function onlineRoomUrlWithWrongKey(roomId: string): Promise<string> {
  const wrongKey = await exportRoomKey(await generateRoomKey());
  return `/online?roomId=${roomId}${buildRoomKeyHash(wrongKey)}`;
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
  const roomId = body.name;

  const key = await generateRoomKey();
  const encodedKey = await exportRoomKey(key);
  const check = await createRoomKeyCheck(key, roomId);

  const patchResponse = await request.patch(emulatorDatabasePath(`/rooms/${roomId}.json`), {
    data: { e2ee: { v: 1, check } },
  });
  expect(patchResponse.ok()).toBeTruthy();

  roomKeyHashes.set(roomId, buildRoomKeyHash(encodedKey));
  return roomId;
}

export type SharedOnlineClients = {
  roomId: string;
  contextA: BrowserContext;
  contextB: BrowserContext;
  pageA: Page;
  pageB: Page;
};

/** Opens the same emulator room in two isolated browser contexts. */
export async function openSharedOnlineRoom(
  browser: Browser,
  request: APIRequestContext,
): Promise<SharedOnlineClients> {
  const roomId = await createOnlineRoom(request);
  // The online toolbar stacks three control groups; the 720px default height pushes "follwer" off-screen.
  const contextOptions = { viewport: { width: 1280, height: 1000 } };
  const contextA = await browser.newContext(contextOptions);
  const contextB = await browser.newContext(contextOptions);
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  await openOnlineRoom(pageA, roomId);
  return { roomId, contextA, contextB, pageA, pageB };
}

export async function joinSharedOnlineRoom(
  clients: SharedOnlineClients,
): Promise<void> {
  await openOnlineRoom(clients.pageB, clients.roomId);
}

export async function closeSharedOnlineClients(clients: SharedOnlineClients): Promise<void> {
  await clients.contextA.close();
  await clients.contextB.close();
}

export async function goToOnlineRoom(
  page: Page,
  request: APIRequestContext,
): Promise<string> {
  const roomId = await createOnlineRoom(request);
  await page.goto(roomUrl(roomId));
  await page.waitForURL(new RegExp(`/online\\?roomId=${roomId}`));
  await waitForCanvas(page);
  return roomId;
}

export async function openOnlineRoom(
  page: Page,
  roomId: string,
): Promise<void> {
  await page.goto(roomUrl(roomId));
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

export async function getRawRoomLines(
  request: APIRequestContext,
  roomId: string,
): Promise<RawRoomLines> {
  const response = await request.get(emulatorDatabasePath(`/rooms/${roomId}/lines.json`));
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as RawRoomLines;
}

export async function expectNoPlaintextLinePoints(
  request: APIRequestContext,
  roomId: string,
): Promise<void> {
  const body = await getRawRoomLines(request, roomId);
  if (body === null) return;

  for (const [, line] of Object.entries(body)) {
    expect(line).not.toHaveProperty("points");
    expect(linePayloadHasIllegalNumbers(line, true)).toBe(false);

    for (const { envelope } of chunkEntries(line.chunks)) {
      expect(typeof envelope).toBe("string");
      expect(envelope).toMatch(/^1\./);
    }
  }
}

export async function getRoomLinesSnapshot(
  request: APIRequestContext,
  roomId: string,
): Promise<RoomLinesSnapshot> {
  const body = await getRawRoomLines(request, roomId);
  const key = await roomKeyForId(roomId);

  if (body === null) {
    return { lineCount: 0, lines: [] };
  }

  const lines = await Promise.all(
    Object.entries(body).map(async ([lineId, value]) => {
      const points: number[] = [];
      for (const { index, envelope } of chunkEntries(value.chunks)) {
        if (typeof envelope !== "string") continue;
        try {
          const chunkPoints = await decryptNumbers(key, envelope, roomId, linePurpose(lineId, index));
          if (chunkPoints.length % 2 === 0) {
            points.push(...chunkPoints);
          }
        } catch {
          // skip failed chunks
        }
      }
      return {
        isDrawing: value.isDrawing === true,
        pointCount: points.length,
        points,
      };
    }),
  );

  lines.sort((a, b) => {
    if (a.pointCount !== b.pointCount) return a.pointCount - b.pointCount;
    return (a.points[0] ?? 0) - (b.points[0] ?? 0);
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

export async function waitForRedStroke(page: Page): Promise<void> {
  await expect.poll(() => canvasHasRedStroke(page)).toBe(true);
}

export async function waitForNoRedStroke(page: Page): Promise<void> {
  await expect.poll(() => canvasHasRedStroke(page)).toBe(false);
}

export async function selectViewMode(
  page: Page,
  mode: "single" | "leader" | "follwer",
): Promise<void> {
  const button = page.getByTestId(`view-${mode}`);
  await expect(button).toBeVisible();
  await button.click({ timeout: 30_000 });
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

export async function clickClearAll(page: Page): Promise<void> {
  const button = page.getByTestId("clear-all");
  await expect(button).toBeVisible();
  await button.click({ timeout: 30_000 });
}

export async function uploadMapImage(page: Page, filePath: string): Promise<void> {
  const input = page.getByTestId("load-image").locator('input[type="file"]');
  await input.setInputFiles(filePath);
}

export async function konvaMapImageLoaded(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const konva = (
      window as unknown as {
        Konva?: {
          stages: {
            find: (selector: string) => { image: () => CanvasImageSource | undefined }[];
          }[];
        };
      }
    ).Konva;
    if (konva === undefined || konva.stages.length === 0) return false;

    return konva.stages[0].find("Image").some((node) => {
      const image = node.image();
      if (image === undefined) return false;
      if (image instanceof HTMLImageElement) {
        return image.complete && image.naturalWidth > 0;
      }
      return true;
    });
  });
}

export async function waitForKonvaMapImage(page: Page): Promise<void> {
  await expect.poll(() => konvaMapImageLoaded(page)).toBe(true);
}

export async function getRoomImageField(
  request: APIRequestContext,
  roomId: string,
): Promise<unknown> {
  const response = await request.get(emulatorDatabasePath(`/rooms/${roomId}/image.json`));
  expect(response.ok()).toBeTruthy();
  return response.json();
}

type StorageListItem = {
  name: string;
  contentType?: string;
};

type StorageListResponse = {
  items?: StorageListItem[];
};

export async function getLatestRawStorageObjectForRoom(
  request: APIRequestContext,
  roomId: string,
): Promise<{ name: string; contentType: string; bytes: Buffer }> {
  const prefix = `${roomId}/`;
  const listUrl = `${EMULATOR_STORAGE_HOST}/v0/b/${STORAGE_BUCKET}/o?prefix=${encodeURIComponent(prefix)}`;
  const listResponse = await request.get(listUrl);
  expect(listResponse.ok()).toBeTruthy();
  const listBody = (await listResponse.json()) as StorageListResponse;
  const items = listBody.items ?? [];
  if (items.length === 0) {
    throw new Error(`no storage objects found for room ${roomId}`);
  }
  const latest = items.reduce((a, b) => (a.name > b.name ? a : b));
  const mediaUrl = `${EMULATOR_STORAGE_HOST}/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(latest.name)}?alt=media`;
  const mediaResponse = await request.get(mediaUrl);
  expect(mediaResponse.ok()).toBeTruthy();
  const bytes = Buffer.from(await mediaResponse.body());
  return {
    name: latest.name,
    contentType: latest.contentType ?? mediaResponse.headers()["content-type"] ?? "",
    bytes,
  };
}

export async function waitForEncryptedRoomImageMeta(
  request: APIRequestContext,
  roomId: string,
): Promise<string> {
  let envelope = "";
  await expect
    .poll(async () => {
      const value = await getRoomImageField(request, roomId);
      if (typeof value !== "string" || value.length === 0) return false;
      if (!value.startsWith("1.")) return false;
      if (value.includes("http")) return false;
      envelope = value;
      return true;
    })
    .toBe(true);
  return envelope;
}

export async function decryptRoomImageFixture(
  request: APIRequestContext,
  roomId: string,
  envelope: string,
): Promise<{ path: string; plaintext: Uint8Array }> {
  const key = await roomKeyForId(roomId);
  const meta = await decryptJson<{ path: string; type: string }>(
    key,
    envelope,
    roomId,
    IMAGE_META_PURPOSE,
  );
  const storageObject = await getLatestRawStorageObjectForRoom(request, roomId);
  const plaintext = await decryptBinary(
    key,
    new Uint8Array(storageObject.bytes),
    roomId,
    imageBlobPurpose(meta.path),
  );
  return { path: meta.path, plaintext };
}

export async function getKonvaViewGroupRotation(page: Page): Promise<number> {
  return page.evaluate(() => {
    const konva = (
      window as unknown as {
        Konva?: {
          stages: {
            getLayers: () => { getChildren: () => { getClassName?: () => string; rotation: () => number }[] }[];
          }[];
        };
      }
    ).Konva;
    if (konva === undefined || konva.stages.length === 0) return 0;

    const layer = konva.stages[0].getLayers()[0];
    if (layer === undefined) return 0;

    const viewGroup = layer
      .getChildren()
      .find((node) => node.getClassName?.() === "Group");
    return viewGroup?.rotation() ?? 0;
  });
}

export async function rotateViewCtrlWheel(
  page: Page,
  deltaY: number,
  repeat = 5,
): Promise<void> {
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
}

type StrokeRatios = {
  startXRatio: number;
  startYRatio: number;
  endXRatio: number;
  endYRatio: number;
};

async function strokePointsFromRatios(
  page: Page,
  ratios: StrokeRatios,
): Promise<{ start: { x: number; y: number }; end: { x: number; y: number } }> {
  const canvas = await waitForCanvas(page);
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error("canvas bounding box not found");
  }

  return {
    start: {
      x: box.x + box.width * ratios.startXRatio,
      y: box.y + box.height * ratios.startYRatio,
    },
    end: {
      x: box.x + box.width * ratios.endXRatio,
      y: box.y + box.height * ratios.endYRatio,
    },
  };
}

export async function beginStrokeOnCanvas(
  page: Page,
  ratios: Partial<StrokeRatios> = {},
): Promise<void> {
  const { startXRatio = 0.4, startYRatio = 0.5, endXRatio = 0.6, endYRatio = 0.5 } = ratios;
  const { start } = await strokePointsFromRatios(page, {
    startXRatio,
    startYRatio,
    endXRatio,
    endYRatio,
  });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
}

export async function moveStrokeOnCanvas(
  page: Page,
  ratios: Partial<StrokeRatios> = {},
  steps = 8,
): Promise<void> {
  const { startXRatio = 0.4, startYRatio = 0.5, endXRatio = 0.6, endYRatio = 0.5 } = ratios;
  const { end } = await strokePointsFromRatios(page, {
    startXRatio,
    startYRatio,
    endXRatio,
    endYRatio,
  });
  await page.mouse.move(end.x, end.y, { steps });
}

export async function endStrokeOnCanvas(page: Page): Promise<void> {
  await page.mouse.up();
}
