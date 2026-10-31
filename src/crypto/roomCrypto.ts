const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BITS = 128;
const ROOM_KEY_BYTES = 32;
const ENVELOPE_VERSION = "1";

const ROOM_KEY_CHECK_PLAINTEXT = "o-route-e2ee-v1";
const ROOM_KEY_CHECK_PURPOSE = "check";
const ENCRYPTION_OVERHEAD_BYTES = 28;

const IMAGE_META_PURPOSE = "image-meta";

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isValidBase64Url(encoded: string): boolean {
  if (encoded.length === 0) return false;
  return /^[A-Za-z0-9_-]+$/.test(encoded);
}

function base64UrlToBytes(encoded: string): Uint8Array {
  if (!isValidBase64Url(encoded)) {
    throw new Error("Invalid base64url");
  }
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLength);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toBufferSource(bytes: Uint8Array): BufferSource {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function buildAad(roomId: string, purpose: string): Uint8Array {
  return new TextEncoder().encode(`o-route/v1/${roomId}/${purpose}`);
}

async function generateRoomKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function exportRoomKey(key: CryptoKey): Promise<string> {
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  return bytesToBase64Url(raw);
}

async function importRoomKey(encoded: string): Promise<CryptoKey> {
  let raw: Uint8Array;
  try {
    raw = base64UrlToBytes(encoded);
  } catch {
    throw new Error("Invalid room key encoding");
  }
  if (raw.length !== ROOM_KEY_BYTES) {
    throw new Error("Invalid room key length");
  }
  return crypto.subtle.importKey(
    "raw",
    toBufferSource(raw),
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function parseRoomKeyFromHash(hash: string): string | null {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (trimmed.length === 0) return null;
  const params = new URLSearchParams(trimmed);
  const key = params.get("k");
  if (key === null || key.length === 0) return null;
  return key;
}

function buildRoomKeyHash(encodedKey: string): string {
  return `#k=${encodedKey}`;
}

async function encryptBytes(
  key: CryptoKey,
  plaintext: Uint8Array,
  roomId: string,
  purpose: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const aad = buildAad(roomId, purpose);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toBufferSource(iv),
        additionalData: toBufferSource(aad),
        tagLength: AES_GCM_TAG_BITS,
      },
      key,
      toBufferSource(plaintext),
    ),
  );
  return `${ENVELOPE_VERSION}.${bytesToBase64Url(iv)}.${bytesToBase64Url(ciphertext)}`;
}

function parseEnvelope(envelope: string): { iv: Uint8Array; ciphertext: Uint8Array } {
  const parts = envelope.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed envelope");
  }
  const [version, ivPart, ciphertextPart] = parts;
  if (
    version !== ENVELOPE_VERSION ||
    typeof ivPart === "undefined" ||
    typeof ciphertextPart === "undefined"
  ) {
    throw new Error("Malformed envelope");
  }
  if (ivPart.length === 0 || ciphertextPart.length === 0) {
    throw new Error("Malformed envelope");
  }
  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    iv = base64UrlToBytes(ivPart);
    ciphertext = base64UrlToBytes(ciphertextPart);
  } catch {
    throw new Error("Malformed envelope");
  }
  if (iv.length !== AES_GCM_IV_BYTES) {
    throw new Error("Malformed envelope");
  }
  return { iv, ciphertext };
}

async function decryptBytes(
  key: CryptoKey,
  envelope: string,
  roomId: string,
  purpose: string,
): Promise<Uint8Array> {
  const { iv, ciphertext } = parseEnvelope(envelope);
  const aad = buildAad(roomId, purpose);
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toBufferSource(iv),
        additionalData: toBufferSource(aad),
        tagLength: AES_GCM_TAG_BITS,
      },
      key,
      toBufferSource(ciphertext),
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new Error("Decryption failed");
  }
}

async function encryptJson(
  key: CryptoKey,
  value: unknown,
  roomId: string,
  purpose: string,
): Promise<string> {
  const json = JSON.stringify(value);
  return encryptBytes(key, new TextEncoder().encode(json), roomId, purpose);
}

async function decryptJson<T>(
  key: CryptoKey,
  envelope: string,
  roomId: string,
  purpose: string,
): Promise<T> {
  const bytes = await decryptBytes(key, envelope, roomId, purpose);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as T;
}

async function encryptNumbers(
  key: CryptoKey,
  values: number[],
  roomId: string,
  purpose: string,
): Promise<string> {
  const buffer = new ArrayBuffer(values.length * 8);
  const view = new DataView(buffer);
  for (let i = 0; i < values.length; i++) {
    view.setFloat64(i * 8, values[i]!, true);
  }
  return encryptBytes(key, new Uint8Array(buffer), roomId, purpose);
}

async function decryptNumbers(
  key: CryptoKey,
  envelope: string,
  roomId: string,
  purpose: string,
): Promise<number[]> {
  const bytes = await decryptBytes(key, envelope, roomId, purpose);
  if (bytes.length % 8 !== 0) {
    throw new Error("Invalid numbers payload length");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = bytes.length / 8;
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(view.getFloat64(i * 8, true));
  }
  return values;
}

async function createRoomKeyCheck(key: CryptoKey, roomId: string): Promise<string> {
  return encryptBytes(
    key,
    new TextEncoder().encode(ROOM_KEY_CHECK_PLAINTEXT),
    roomId,
    ROOM_KEY_CHECK_PURPOSE,
  );
}

async function verifyRoomKeyCheck(
  key: CryptoKey,
  roomId: string,
  envelope: unknown,
): Promise<boolean> {
  if (typeof envelope !== "string") return false;
  try {
    const bytes = await decryptBytes(key, envelope, roomId, ROOM_KEY_CHECK_PURPOSE);
    return new TextDecoder().decode(bytes) === ROOM_KEY_CHECK_PLAINTEXT;
  } catch {
    return false;
  }
}

function linePurpose(lineId: string, chunkIndex: number): string {
  return `line/${lineId}/${chunkIndex}`;
}

function viewPurpose(leaderId: string): string {
  return `view/${leaderId}`;
}

function imageBlobPurpose(path: string): string {
  return `image-blob/${path}`;
}

export {
  ENCRYPTION_OVERHEAD_BYTES,
  IMAGE_META_PURPOSE,
  ROOM_KEY_CHECK_PLAINTEXT,
  ROOM_KEY_CHECK_PURPOSE,
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
  imageBlobPurpose,
  importRoomKey,
  linePurpose,
  parseRoomKeyFromHash,
  verifyRoomKeyCheck,
  viewPurpose,
};
