import { test, expect } from "@playwright/test";
import {
  createOnlineRoom,
  emulatorDatabasePath,
  onlineRoomUrlWithWrongKey,
  onlineRoomUrlWithoutKey,
  roomUrl,
  waitForCanvas,
} from "./helpers";

function emulatorE2eePath(roomId: string): string {
  return emulatorDatabasePath(`/rooms/${roomId}/e2ee.json`);
}

test.describe("room key (E2EE phase 2)", () => {
  test("enter-online creates room with key in URL hash and e2ee check in DB", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(async () => {
      await page.getByTestId("enter-online").click();
      await expect(page).toHaveURL(/\/online\?roomId=[^#]+#k=[A-Za-z0-9_-]{43}$/, {
        timeout: 2_000,
      });
    }).toPass({ timeout: 30_000 });

    await waitForCanvas(page);

    const url = page.url();
    const match = url.match(/roomId=([^&#]+)/);
    expect(match).not.toBeNull();
    const roomId = match![1]!;

    const e2eeResponse = await request.get(emulatorE2eePath(roomId));
    expect(e2eeResponse.ok()).toBeTruthy();
    const e2eeBody = (await e2eeResponse.json()) as { check?: string };
    expect(typeof e2eeBody.check).toBe("string");
    expect(e2eeBody.check!.startsWith("1.")).toBe(true);
  });

  test("redirects when room URL has no key hash", async ({ page, request }) => {
    const roomId = await createOnlineRoom(request);
    await page.goto(onlineRoomUrlWithoutKey(roomId));
    await expect(page).toHaveURL(/\/errors\/invalid_room_key/, { timeout: 30_000 });
    await expect(page.getByTestId("invalid-room-key")).toBeVisible();
  });

  test("redirects when room URL has wrong key", async ({ page, request }) => {
    const roomId = await createOnlineRoom(request);
    const wrongUrl = await onlineRoomUrlWithWrongKey(roomId);
    await page.goto(wrongUrl);
    await expect(page).toHaveURL(/\/errors\/invalid_room_key/, { timeout: 30_000 });
    await expect(page.getByTestId("invalid-room-key")).toBeVisible();
  });

  test("redirects when room URL has malformed key", async ({ page, request }) => {
    const roomId = await createOnlineRoom(request);
    await page.goto(`/online?roomId=${roomId}#k=abc`);
    await expect(page).toHaveURL(/\/errors\/invalid_room_key/, { timeout: 30_000 });
    await expect(page.getByTestId("invalid-room-key")).toBeVisible();
  });

  test("reload preserves hash and canvas stays usable", async ({ page, request }) => {
    const roomId = await createOnlineRoom(request);
    await page.goto(roomUrl(roomId));
    await waitForCanvas(page);

    await page.reload();
    await page.waitForURL(new RegExp(`/online\\?roomId=${roomId}#k=`));
    await waitForCanvas(page);
  });
});
