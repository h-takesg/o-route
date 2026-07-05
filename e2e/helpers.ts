import { expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";

const EMULATOR_DATABASE_HOST = "http://127.0.0.1:9000";
const EMULATOR_DATABASE_NS = "o-route-default-rtdb";

function emulatorDatabasePath(path: string): string {
  return `${EMULATOR_DATABASE_HOST}${path}?ns=${EMULATOR_DATABASE_NS}`;
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
  const canvas = await waitForCanvas(page);
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error("canvas bounding box not found");
  }

  const start = { x: box.x + box.width * 0.4, y: box.y + box.height * 0.5 };
  const end = { x: box.x + box.width * 0.6, y: box.y + box.height * 0.5 };

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
