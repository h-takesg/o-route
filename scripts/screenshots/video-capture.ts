import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { HOME_IMAGES_DIR, pngBufferToWebp } from "./capture-utils";

export const VIDEO_FPS = 24;
export const VIDEO_TARGET_SECONDS = 6;

export type CursorHint = "wheel" | "ctrl-wheel" | undefined;

export type FrameOverlay = {
  cursorX: number;
  cursorY: number;
  hint?: CursorHint;
};

export type EncodedVideo = {
  path: string;
  bytes: number;
  width: number;
  height: number;
  durationSec: number;
  codec: string;
};

export class VideoFrameBuffer {
  readonly frames: Buffer[] = [];

  push(frame: Buffer): void {
    this.frames.push(frame);
  }

  padToDuration(fps: number, seconds: number, fill: Buffer): void {
    const target = Math.round(fps * seconds);
    while (this.frames.length < target) {
      this.frames.push(fill);
    }
    if (this.frames.length > target) {
      this.frames.length = target;
    }
  }
}

export async function captureViewportPng(page: Page): Promise<Buffer> {
  return page.screenshot({ type: "png" });
}

export async function addOverlayToPng(
  page: Page,
  pngBuffer: Buffer,
  overlay: FrameOverlay,
): Promise<Buffer> {
  const b64 = pngBuffer.toString("base64");
  const out = await page.evaluate(
    async ({ b64, overlay }) => {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("png load failed"));
        img.src = `data:image/png;base64,${b64}`;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx === null) throw new Error("2d unavailable");
      ctx.drawImage(img, 0, 0);
      const { cursorX, cursorY, hint } = overlay;
      ctx.save();
      ctx.translate(cursorX, cursorY);
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 18);
      ctx.lineTo(5, 14);
      ctx.lineTo(9, 22);
      ctx.lineTo(12, 20);
      ctx.lineTo(8, 12);
      ctx.lineTo(14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (hint !== undefined) {
        const text = hint === "ctrl-wheel" ? "Ctrl + ホイール" : "ホイール";
        ctx.font = "14px sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.94)";
        ctx.strokeStyle = "rgba(0,0,0,0.75)";
        ctx.lineWidth = 3;
        const tx = Math.min(cursorX + 18, canvas.width - 140);
        const ty = Math.max(cursorY - 10, 18);
        ctx.strokeText(text, tx, ty);
        ctx.fillText(text, tx, ty);
      }
      return canvas.toDataURL("image/png");
    },
    { b64, overlay },
  );
  const match = /^data:image\/png;base64,(.+)$/.exec(out);
  if (match === null) throw new Error("overlay composite failed");
  return Buffer.from(match[1], "base64");
}

export async function compositeSideBySidePng(
  page: Page,
  leftPng: Buffer,
  rightPng: Buffer,
  gutterPx = 8,
): Promise<Buffer> {
  const leftB64 = leftPng.toString("base64");
  const rightB64 = rightPng.toString("base64");
  const pngOut = await page.evaluate(
    async ({ leftB64, rightB64, gutterPx }) => {
      const load = (b64: string) =>
        new Promise<{ w: number; h: number; img: HTMLImageElement }>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight, img });
          img.onerror = () => reject(new Error("image load failed"));
          img.src = `data:image/png;base64,${b64}`;
        });
      const left = await load(leftB64);
      const right = await load(rightB64);
      const width = left.w + gutterPx + right.w;
      const height = Math.max(left.h, right.h);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx === null) throw new Error("2d unavailable");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(left.img, 0, 0);
      ctx.drawImage(right.img, left.w + gutterPx, 0);
      return canvas.toDataURL("image/png");
    },
    { leftB64, rightB64, gutterPx },
  );
  const match = /^data:image\/png;base64,(.+)$/.exec(pngOut);
  if (match === null) throw new Error("side by side failed");
  return Buffer.from(match[1], "base64");
}

export async function encodeWebmFromPngFrames(
  page: Page,
  frames: Buffer[],
  width: number,
  height: number,
  filename: string,
  fps = VIDEO_FPS,
): Promise<EncodedVideo> {
  const setup = await page.evaluate(({ width, height, fps }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("2d unavailable");
    const stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0];
    const tryVp9 = MediaRecorder.isTypeSupported("video/webm;codecs=vp9");
    const mime = tryVp9 ? "video/webm;codecs=vp9" : "video/webm;codecs=vp8";
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 2_500_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const w = window as unknown as {
      __oRouteVideoEncode?: {
        ctx: CanvasRenderingContext2D;
        track: MediaStreamTrack;
        recorder: MediaRecorder;
        chunks: Blob[];
        mime: string;
        codec: string;
        fps: number;
        frameCount: number;
      };
    };
    w.__oRouteVideoEncode = {
      ctx,
      track,
      recorder,
      chunks,
      mime,
      codec: tryVp9 ? "vp9" : "vp8",
      fps,
      frameCount: 0,
    };
    recorder.start();
    return { codec: tryVp9 ? "vp9" : "vp8" };
  }, { width, height, fps });

  for (const frame of frames) {
    const b64 = frame.toString("base64");
    await page.evaluate(
      async ({ b64, width, height }) => {
        const state = (window as unknown as { __oRouteVideoEncode?: {
          ctx: CanvasRenderingContext2D;
          track: MediaStreamTrack;
          fps: number;
          frameCount: number;
        } }).__oRouteVideoEncode;
        if (state === undefined) throw new Error("video encode not initialized");
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            state.ctx.drawImage(img, 0, 0, width, height);
            resolve();
          };
          img.onerror = () => reject(new Error("frame decode failed"));
          img.src = `data:image/png;base64,${b64}`;
        });
        (state.track as unknown as { requestFrame: () => void }).requestFrame();
        state.frameCount += 1;
        await new Promise((r) => setTimeout(r, Math.round(1000 / state.fps)));
      },
      { b64, width, height },
    );
  }

  const result = await page.evaluate(async () => {
    const state = (window as unknown as {
      __oRouteVideoEncode?: {
        recorder: MediaRecorder;
        chunks: Blob[];
        mime: string;
        codec: string;
        fps: number;
        frameCount: number;
      };
    }).__oRouteVideoEncode;
    if (state === undefined) throw new Error("video encode not initialized");
    const done = new Promise<void>((resolve) => {
      state.recorder.onstop = () => resolve();
    });
    state.recorder.stop();
    await done;
    const blob = new Blob(state.chunks, { type: state.mime });
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return {
      b64: btoa(binary),
      codec: state.codec,
      durationSec: state.frameCount / state.fps,
    };
  });

  const webm = Buffer.from(result.b64, "base64");
  const outPath = path.join(HOME_IMAGES_DIR, filename);
  writeFileSync(outPath, webm);
  return {
    path: outPath,
    bytes: webm.length,
    width,
    height,
    durationSec: result.durationSec,
    codec: setup.codec,
  };
}

export async function verifyWebmInChromium(
  page: Page,
  webmPath: string,
  expectedWidth: number,
  expectedHeight: number,
): Promise<void> {
  const b64 = readFileSync(webmPath).toString("base64");
  const ok = await page.evaluate(
    async ({ b64, expectedWidth, expectedHeight }) => {
      const video = document.createElement("video");
      video.src = `data:video/webm;base64,${b64}`;
      video.muted = true;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("video load failed"));
      });
      return (
        video.duration > 0 &&
        video.videoWidth === expectedWidth &&
        video.videoHeight === expectedHeight
      );
    },
    { b64, expectedWidth, expectedHeight },
  );
  if (!ok) throw new Error(`WebM verification failed for ${webmPath}`);
}

export async function saveVideoPreviewFrames(
  frames: Buffer[],
  previewDir: string,
  basename: string,
): Promise<{ start: string; middle: string; end: string }> {
  mkdirSync(previewDir, { recursive: true });
  const indices = [0, Math.floor(frames.length / 2), frames.length - 1];
  const names = ["start", "middle", "end"] as const;
  const paths: Record<(typeof names)[number], string> = {
    start: "",
    middle: "",
    end: "",
  };
  for (let i = 0; i < names.length; i += 1) {
    const idx = indices[i];
    const out = path.join(previewDir, `${basename}-${names[i]}.png`);
    writeFileSync(out, frames[idx]);
    paths[names[i]] = out;
  }
  return paths;
}

export async function saveStillFromPng(
  page: Page,
  pngBuffer: Buffer,
  webpFilename: string,
  quality = 0.85,
): Promise<{ path: string; bytes: number }> {
  const webp = await pngBufferToWebp(page, pngBuffer, quality);
  const outPath = path.join(HOME_IMAGES_DIR, webpFilename);
  writeFileSync(outPath, webp);
  return { path: outPath, bytes: webp.length };
}

export async function recordFrame(
  page: Page,
  buffer: VideoFrameBuffer,
  overlay?: FrameOverlay,
): Promise<void> {
  const png = await captureViewportPng(page);
  if (overlay === undefined) {
    buffer.push(png);
    return;
  }
  buffer.push(await addOverlayToPng(page, png, overlay));
}

export async function canvasCenterOverlay(page: Page): Promise<FrameOverlay> {
  const box = await page.locator('[data-testid="canvas-stage"]').boundingBox();
  if (box === null) throw new Error("canvas stage missing");
  return { cursorX: box.width / 2, cursorY: box.height / 2 };
}
