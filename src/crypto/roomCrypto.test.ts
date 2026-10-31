import { describe, expect, it } from "vitest";
import {
  buildRoomKeyHash,
  createRoomKeyCheck,
  decryptBytes,
  decryptJson,
  decryptNumbers,
  encryptBytes,
  encryptJson,
  encryptNumbers,
  exportRoomKey,
  generateRoomKey,
  importRoomKey,
  parseRoomKeyFromHash,
  verifyRoomKeyCheck,
} from "./roomCrypto";

const roomId = "room-abc";
const purpose = "test-purpose";

describe("roomCrypto", () => {
  it("round-trips bytes", async () => {
    const key = await generateRoomKey();
    const plaintext = new Uint8Array([1, 2, 3, 255, 0]);
    const envelope = await encryptBytes(key, plaintext, roomId, purpose);
    const decrypted = await decryptBytes(key, envelope, roomId, purpose);
    expect(Array.from(decrypted)).toEqual(Array.from(plaintext));
  });

  it("round-trips json", async () => {
    const key = await generateRoomKey();
    const value = { a: 1, nested: { b: "x" } };
    const envelope = await encryptJson(key, value, roomId, purpose);
    const decrypted = await decryptJson<typeof value>(key, envelope, roomId, purpose);
    expect(decrypted).toEqual(value);
  });

  it("round-trips numbers including fractional and negative values", async () => {
    const key = await generateRoomKey();
    const values = [0, -1.5, Math.PI, Number.EPSILON, -0];
    const envelope = await encryptNumbers(key, values, roomId, purpose);
    const decrypted = await decryptNumbers(key, envelope, roomId, purpose);
    expect(decrypted).toEqual(values);
  });

  it("fails decryption with wrong key", async () => {
    const key = await generateRoomKey();
    const otherKey = await generateRoomKey();
    const envelope = await encryptBytes(key, new Uint8Array([1]), roomId, purpose);
    await expect(decryptBytes(otherKey, envelope, roomId, purpose)).rejects.toThrow();
  });

  it("fails decryption when ciphertext is tampered", async () => {
    const key = await generateRoomKey();
    const envelope = await encryptBytes(key, new Uint8Array([1, 2, 3]), roomId, purpose);
    const parts = envelope.split(".");
    const ciphertext = parts[2]!;
    // The first base64url char carries 6 full bits, so swapping it always changes the bytes.
    const swapped = ciphertext[0] === "A" ? "B" : "A";
    const tampered = `${parts[0]}.${parts[1]}.${swapped}${ciphertext.slice(1)}`;
    await expect(decryptBytes(key, tampered, roomId, purpose)).rejects.toThrow();
  });

  it("fails decryption on AAD roomId mismatch", async () => {
    const key = await generateRoomKey();
    const envelope = await encryptBytes(key, new Uint8Array([9]), roomId, purpose);
    await expect(decryptBytes(key, envelope, "other-room", purpose)).rejects.toThrow();
  });

  it("fails decryption on AAD purpose mismatch", async () => {
    const key = await generateRoomKey();
    const envelope = await encryptBytes(key, new Uint8Array([9]), roomId, purpose);
    await expect(decryptBytes(key, envelope, roomId, "other-purpose")).rejects.toThrow();
  });

  it("rejects malformed envelope version", async () => {
    const key = await generateRoomKey();
    const envelope = await encryptBytes(key, new Uint8Array([1]), roomId, purpose);
    const bad = envelope.replace(/^1\./, "2.");
    await expect(decryptBytes(key, bad, roomId, purpose)).rejects.toThrow();
  });

  it("rejects envelope with missing parts", async () => {
    const key = await generateRoomKey();
    await expect(decryptBytes(key, "1.only-one-part", roomId, purpose)).rejects.toThrow();
  });

  it("rejects envelope with invalid base64url", async () => {
    const key = await generateRoomKey();
    await expect(decryptBytes(key, "1.!!!.!!!", roomId, purpose)).rejects.toThrow();
  });

  it("export/import roundtrip decrypts with imported key", async () => {
    const key = await generateRoomKey();
    const encoded = await exportRoomKey(key);
    const imported = await importRoomKey(encoded);
    const envelope = await encryptBytes(key, new Uint8Array([7, 8]), roomId, purpose);
    const decrypted = await decryptBytes(imported, envelope, roomId, purpose);
    expect(Array.from(decrypted)).toEqual([7, 8]);
  });

  it("importRoomKey rejects wrong decoded length", async () => {
    const shortKey = Buffer.from("too-short").toString("base64url");
    await expect(importRoomKey(shortKey)).rejects.toThrow();
  });

  it("parseRoomKeyFromHash handles hash forms", () => {
    expect(parseRoomKeyFromHash("#k=abc")).toBe("abc");
    expect(parseRoomKeyFromHash("k=abc")).toBe("abc");
    expect(parseRoomKeyFromHash("#a=1&k=xyz")).toBe("xyz");
    expect(parseRoomKeyFromHash("#")).toBeNull();
    expect(parseRoomKeyFromHash("")).toBeNull();
    expect(parseRoomKeyFromHash("#a=1")).toBeNull();
    expect(parseRoomKeyFromHash("#k=")).toBeNull();
  });

  it("buildRoomKeyHash wraps encoded key", () => {
    expect(buildRoomKeyHash("mykey")).toBe("#k=mykey");
  });

  it("room key check verifies valid envelope", async () => {
    const key = await generateRoomKey();
    const check = await createRoomKeyCheck(key, roomId);
    await expect(verifyRoomKeyCheck(key, roomId, check)).resolves.toBe(true);
  });

  it("room key check fails for wrong key or non-string envelope", async () => {
    const key = await generateRoomKey();
    const otherKey = await generateRoomKey();
    const check = await createRoomKeyCheck(key, roomId);
    await expect(verifyRoomKeyCheck(otherKey, roomId, check)).resolves.toBe(false);
    await expect(verifyRoomKeyCheck(key, roomId, null)).resolves.toBe(false);
    await expect(verifyRoomKeyCheck(key, roomId, 123)).resolves.toBe(false);
  });

  it("uses different IVs for repeated plaintext", async () => {
    const key = await generateRoomKey();
    const plaintext = new Uint8Array([42]);
    const first = await encryptBytes(key, plaintext, roomId, purpose);
    const second = await encryptBytes(key, plaintext, roomId, purpose);
    expect(first).not.toBe(second);
    const firstIv = first.split(".")[1];
    const secondIv = second.split(".")[1];
    expect(firstIv).not.toBe(secondIv);
  });

  it("decryptNumbers rejects payload whose length is not a multiple of 8", async () => {
    const key = await generateRoomKey();
    const envelope = await encryptBytes(key, new Uint8Array([1, 2, 3]), roomId, purpose);
    await expect(decryptNumbers(key, envelope, roomId, purpose)).rejects.toThrow();
  });
});
