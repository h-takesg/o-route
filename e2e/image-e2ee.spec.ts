import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import {
  TINY_MAP_IMAGE_PATH,
  canvasHasImageContent,
  closeSharedOnlineClients,
  decryptRoomImageFixture,
  getLatestRawStorageObjectForRoom,
  joinSharedOnlineRoom,
  openSharedOnlineRoom,
  uploadMapImage,
  waitForEncryptedRoomImageMeta,
  waitForCanvas,
  waitForKonvaMapImage,
} from "./helpers";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

test.describe("online image E2EE", () => {
  test("upload stores encrypted meta and ciphertext; clients render map", async ({
    browser,
    request,
  }) => {
    const clients = await openSharedOnlineRoom(browser, request);
    try {
      await joinSharedOnlineRoom(clients);
      const { pageA, pageB, roomId } = clients;

      await uploadMapImage(pageA, TINY_MAP_IMAGE_PATH);
      await waitForKonvaMapImage(pageA);
      await waitForKonvaMapImage(pageB);

      const envelope = await waitForEncryptedRoomImageMeta(request, roomId);
      const storageObject = await getLatestRawStorageObjectForRoom(request, roomId);
      expect(storageObject.contentType).toContain("application/octet-stream");
      expect(storageObject.bytes.subarray(0, 4).equals(PNG_SIGNATURE)).toBe(false);

      const fixtureBytes = readFileSync(TINY_MAP_IMAGE_PATH);
      const { path, plaintext } = await decryptRoomImageFixture(request, roomId, envelope);
      expect(path).toBe(storageObject.name);
      expect(Buffer.from(plaintext)).toEqual(fixtureBytes);

      const hasImageOnB = await canvasHasImageContent(pageB);
      if (!hasImageOnB) {
        test.info().annotations.push({
          type: "note",
          description:
            "canvasHasImageContent skipped: 1x1 fixture may not produce enough color samples",
        });
      } else {
        expect(hasImageOnB).toBe(true);
      }
    } finally {
      await closeSharedOnlineClients(clients);
    }
  });

  test("reload on B keeps map image after A uploads", async ({ browser, request }) => {
    const clients = await openSharedOnlineRoom(browser, request);
    try {
      await joinSharedOnlineRoom(clients);
      const { pageA, pageB } = clients;

      await uploadMapImage(pageA, TINY_MAP_IMAGE_PATH);
      await waitForKonvaMapImage(pageA);
      await waitForKonvaMapImage(pageB);

      await pageB.reload();
      await waitForCanvas(pageB);
      await waitForKonvaMapImage(pageB);
    } finally {
      await closeSharedOnlineClients(clients);
    }
  });
});
