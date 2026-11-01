/**
 * Deterministic fictional ISOM-style sample map (SVG → PNG via Playwright).
 * Terrain is authored with explicit geometry; noise perturbs edges only.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = __dirname;
const WIDTH = 2400;
const HEIGHT = 1700;
/** Fixed seed — byte-identical output on every run. */
const MAP_SEED = 0x4f524f55;

/**
 * Map drawn at 1:10000; symbol dimensions = ISOM 2017-2 @ 1:15000 × 1.5 (IOF ISOM 2017-2).
 * 100 m on ground = 10 mm on map → scale bar length 10 × PX_PER_MM px (100 px at PX_PER_MM=10).
 */
const PX_PER_MM = 10;
const mm = (mmAt15000) => mmAt15000 * 1.5 * PX_PER_MM;

/**
 * Screen sRGB from OpenOrienteering/mapper `symbol sets/src/ISOM 2017-2_15000.xmap`
 * (blob 8eb3af0e6675fa4dde498a2212e10b526e75e7ea, master 2026). `<rgb>` on spot inks with
 * method="cmyk" is not screen-accurate; Blue/Green/Purple use FOGRA39-style sRGB (IOF PMS).
 */
function oomRgb(r, g, b) {
  return `#${[r, g, b]
    .map((v) => Math.round(v * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixWhiteHex(hex, whiteFraction) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const t = whiteFraction;
  const mix = (c) => Math.round(c * (1 - t) + 255 * t);
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const FOGRA_SCREEN = {
  BLUE: "#009fe3",
  GREEN: "#3fa535",
  PURPLE: "#b04a94",
};

const ISOM = {
  BLACK: oomRgb(0, 0, 0),
  BLUE: FOGRA_SCREEN.BLUE,
  BLUE_50: mixWhiteHex(FOGRA_SCREEN.BLUE, 0.5),
  BLUE_30: mixWhiteHex(FOGRA_SCREEN.BLUE, 0.7),
  YELLOW: oomRgb(1, 0.73, 0.21),
  YELLOW_50: oomRgb(1, 0.865, 0.605),
  GREEN: FOGRA_SCREEN.GREEN,
  GREEN_50: mixWhiteHex(FOGRA_SCREEN.GREEN, 0.4),
  GREEN_30: mixWhiteHex(FOGRA_SCREEN.GREEN, 0.7),
  BROWN: oomRgb(0.82, 0.361, 0),
  BROWN_50: oomRgb(0.91, 0.68, 0.5),
  PURPLE: FOGRA_SCREEN.PURPLE,
  WHITE: "#ffffff",
};

/** Line widths from OOM ISOM 2017-2_15000.xmap symbols 101/102/304/506/504/503/601.2/705. */
const STROKE = {
  contour: mm(0.14),
  contourIndex: mm(0.25),
  stream: mm(0.3),
  path: mm(0.18),
  track: mm(0.35),
  roadOutline: mm(0.35),
  northLine: mm(0.1),
  overprint: mm(0.35),
  marshDash: mm(0.18),
};

const ROAD_FILL_W = mm(1.2);
/** Course overprint 703/705/706/704 @ 1:15000 (×1.5 for 1:10000). */
const CONTROL_R = (5.0 * 1.5 * PX_PER_MM) / 2;
const FINISH_INNER_R = (5.0 * 1.5 * PX_PER_MM) / 2;
const FINISH_OUTER_R = (7.0 * 1.5 * PX_PER_MM) / 2;
const START_TRI_SIDE = 6.0 * 1.5 * PX_PER_MM;
const CONTROL_NUM_PX = mm(4.0);
const SCALE_BAR_M = 100;
const SCALE_BAR_PX = (SCALE_BAR_M / 10000) * 1000 * PX_PER_MM;

const MULTIPLY = 'style="mix-blend-mode:multiply"';

function hash2i(x, y, salt) {
  let h = (x * 374761393 + y * 668265263 + salt * 1442695041 + MAP_SEED) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function valueAt(ix, iy, salt) {
  return hash2i(ix, iy, salt) / 4294967296;
}

function valueNoise(x, y, salt, scale = 1) {
  const sx = x * scale;
  const sy = y * scale;
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const tx = fade(sx - x0);
  const ty = fade(sy - y0);
  const v00 = valueAt(x0, y0, salt);
  const v10 = valueAt(x0 + 1, y0, salt);
  const v01 = valueAt(x0, y0 + 1, salt);
  const v11 = valueAt(x0 + 1, y0 + 1, salt);
  return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
}

function gauss2d(x, y, cx, cy, sx, sy, amp) {
  return amp * Math.exp(-(((x - cx) ** 2) / (2 * sx ** 2) + ((y - cy) ** 2) / (2 * sy ** 2)));
}

/** Authored relief + subtle fine noise; valley drains south past the lake */
function authoredHeight(x, y) {
  let h = 0;
  h += gauss2d(x, y, 620, 400, 440, 400, 1.05);
  h += gauss2d(x, y, 1820, 500, 400, 360, 0.95);
  h += gauss2d(x, y, 1520, 680, 300, 200, 0.42);
  h += gauss2d(x, y, 1720, 1350, 170, 150, 0.4);
  h += gauss2d(x, y, 1940, 720, 220, 130, 0.28);
  h -= gauss2d(x, y, 1160, 1020, 480, 620, 1.08);
  h -= gauss2d(x, y, 1140, 1380, 170, 420, 0.62);
  h -= gauss2d(x, y, 1120, 1580, 150, 280, 0.45);
  h -= gauss2d(x, y, 1100, 1680, 120, 180, 0.28);
  h -= gauss2d(x, y, 1180, 280, 240, 520, 0.42);
  h -= gauss2d(x, y, 840, 590, 150, 110, 0.3);
  h -= gauss2d(x, y, 1640, 610, 140, 100, 0.28);
  h += (valueNoise(x, y, 777, 0.011) - 0.5) * 0.07;
  return h;
}

const HEIGHT_GRID_W = 80;
const HEIGHT_GRID_H = 57;

function sampleGrid(fn, gridW, gridH) {
  const grid = [];
  for (let j = 0; j <= gridH; j++) {
    const row = [];
    for (let i = 0; i <= gridW; i++) {
      row.push(fn((i / gridW) * WIDTH, (j / gridH) * HEIGHT));
    }
    grid.push(row);
  }
  return grid;
}

function smoothGrid(grid, gridW, gridH, passes) {
  let g = grid;
  for (let p = 0; p < passes; p++) {
    const next = g.map((row) => row.slice());
    for (let j = 1; j < gridH; j++) {
      for (let i = 1; i < gridW; i++) {
        let s = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            s += g[j + dj][i + di];
          }
        }
        next[j][i] = s / 9;
      }
    }
    g = next;
  }
  return g;
}

const MS_EDGE = [
  [],
  [[3, 0]],
  [[0, 1]],
  [[3, 1]],
  [[1, 2]],
  [
    [3, 0],
    [1, 2],
  ],
  [[0, 2]],
  [[3, 2]],
  [[2, 3]],
  [[2, 0]],
  [
    [0, 1],
    [2, 3],
  ],
  [[2, 1]],
  [[1, 3]],
  [[1, 0]],
  [[0, 3]],
  [],
];

function msEdgePoint(i, j, edge, level, grid, gridW, gridH, mapW, mapH) {
  const cellW = mapW / gridW;
  const cellH = mapH / gridH;
  const x = i * cellW;
  const y = j * cellH;
  const h00 = grid[j][i];
  const h10 = grid[j][i + 1];
  const h01 = grid[j + 1][i];
  const h11 = grid[j + 1][i + 1];
  const lerpT = (va, vb) => {
    if (Math.abs(vb - va) < 1e-9) return 0.5;
    return (level - va) / (vb - va);
  };
  switch (edge) {
    case 0: {
      const t = lerpT(h00, h10);
      return [x + t * cellW, y];
    }
    case 1: {
      const t = lerpT(h10, h11);
      return [x + cellW, y + t * cellH];
    }
    case 2: {
      const t = lerpT(h01, h11);
      return [x + t * cellW, y + cellH];
    }
    case 3: {
      const t = lerpT(h00, h01);
      return [x, y + t * cellH];
    }
    default:
      return [x, y];
  }
}

function contourSegmentsOnGrid(grid, gridW, gridH, level, mapW, mapH) {
  const segments = [];
  for (let j = 0; j < gridH; j++) {
    for (let i = 0; i < gridW; i++) {
      const h00 = grid[j][i];
      const h10 = grid[j][i + 1];
      const h11 = grid[j + 1][i + 1];
      const h01 = grid[j + 1][i];
      let idx = 0;
      if (h00 >= level) idx |= 1;
      if (h10 >= level) idx |= 2;
      if (h11 >= level) idx |= 4;
      if (h01 >= level) idx |= 8;
      idx = idx === 5 || idx === 10 ? 16 - idx : idx;
      for (const [e0, e1] of MS_EDGE[idx]) {
        segments.push([
          msEdgePoint(i, j, e0, level, grid, gridW, gridH, mapW, mapH),
          msEdgePoint(i, j, e1, level, grid, gridW, gridH, mapW, mapH),
        ]);
      }
    }
  }
  return segments;
}

function pointKey(p) {
  return `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
}

function segKey(p, q) {
  const a = pointKey(p);
  const b = pointKey(q);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function joinSegments(segments) {
  const adj = new Map();
  for (const [p0, p1] of segments) {
    for (const [k, other] of [
      [pointKey(p0), p1],
      [pointKey(p1), p0],
    ]) {
      if (!adj.has(k)) adj.set(k, []);
      adj.get(k).push(other);
    }
  }
  const used = new Set();
  const polylines = [];
  for (const [p0, p1] of segments) {
    const sk = segKey(p0, p1);
    if (used.has(sk)) continue;
    const chain = [p0, p1];
    used.add(sk);
    const walk = (endIdx) => {
      for (;;) {
        const end = chain[endIdx];
        const neighbors = (adj.get(pointKey(end)) || []).filter((n) => !used.has(segKey(end, n)));
        if (neighbors.length === 0) break;
        const next = neighbors[0];
        used.add(segKey(end, next));
        if (endIdx === 0) chain.unshift(next);
        else chain.push(next);
      }
    };
    walk(0);
    walk(chain.length - 1);
    if (chain.length >= 2) polylines.push(chain);
  }
  return polylines;
}

function dist2(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
}

function polylineLength(points, closed = false) {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  if (closed && points.length > 2) {
    len += Math.hypot(
      points[points.length - 1][0] - points[0][0],
      points[points.length - 1][1] - points[0][1],
    );
  }
  return len;
}

function simplifyRdp(points, eps) {
  if (points.length <= 2) return points;
  let maxD = 0;
  let idx = 0;
  const a = points[0];
  const b = points[points.length - 1];
  const ab2 = dist2(a, b) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / ab2;
    const proj = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    const d = Math.sqrt(dist2(p, proj));
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [a, b];
  const left = simplifyRdp(points.slice(0, idx + 1), eps);
  const right = simplifyRdp(points.slice(idx), eps);
  return left.slice(0, -1).concat(right);
}

function chaikin(points, iterations = 1, closed = false) {
  let pts = points.slice();
  if (closed && pts.length > 2) {
    const gap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
    if (gap > 1) pts.push(pts[0]);
  }
  for (let n = 0; n < iterations; n++) {
    if (pts.length < 3) break;
    const out = [];
    const last = pts.length - (closed ? 1 : 0);
    for (let i = 0; i < last; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      out.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
      out.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
    }
    if (closed) out.push(out[0]);
    else {
      out.unshift(pts[0]);
      out.push(pts[pts.length - 1]);
    }
    pts = out;
  }
  return pts;
}

function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    a += poly[i][0] * poly[i + 1][1] - poly[i + 1][0] * poly[i][1];
  }
  return Math.abs(a) / 2;
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function polylinePath(points, close = false) {
  if (points.length < 2) return "";
  let d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  if (close) d += " Z";
  return d;
}

function catmullRomPath(pts, tension = 0.55) {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    return `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} L${pts[1][0].toFixed(1)},${pts[1][1].toFixed(1)}`;
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const cp1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const cp1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const cp2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const cp2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

function offsetPolyline(pts, dist) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    out.push([pts[i][0] + (-dy / len) * dist, pts[i][1] + (dx / len) * dist]);
  }
  return out;
}

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function polygonPoints(pts) {
  return pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
}

/** Irregular patch: Fourier radius + noise, optional elongation along rot */
function irregularPatch(cx, cy, rx, ry, rot, salt, opts = {}) {
  const a2 = opts.a2 ?? 0.14;
  const a3 = opts.a3 ?? 0.09;
  const phi2 = opts.phi2 ?? 0.6;
  const phi3 = opts.phi3 ?? 1.1;
  const n = opts.n ?? 52;
  const scale = opts.scale ?? 1;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const ell =
      (rx * ry) / Math.sqrt((ry * ca) ** 2 + (rx * sa) ** 2 || 1);
    const mod =
      1 +
      a2 * Math.cos(2 * ang + phi2) +
      a3 * Math.cos(3 * ang + phi3) +
      0.04 * (valueNoise(cx + ca * 80, cy + sa * 80, salt, 0.012) - 0.5);
    const r = ell * mod * scale;
    const lx = r * ca;
    const ly = r * sa;
    pts.push([cx + lx * cosR - ly * sinR, cy + lx * sinR + ly * cosR]);
  }
  return chaikin(simplifyRdp(pts.concat([pts[0]]), 5), 2, true);
}

function perturbedPatch(cx, cy, rx, ry, rot, salt, opts) {
  return irregularPatch(cx, cy, rx, ry, rot, salt, opts);
}

function closedLoopsAtLevel(grid, gridW, gridH, level, minArea) {
  const segs = contourSegmentsOnGrid(grid, gridW, gridH, level, WIDTH, HEIGHT);
  const lines = joinSegments(segs);
  const out = [];
  for (let poly of lines) {
    const gap = Math.hypot(poly[0][0] - poly[poly.length - 1][0], poly[0][1] - poly[poly.length - 1][1]);
    if (gap > 30) continue;
    if (gap > 0.5) poly = poly.concat([poly[0]]);
    poly = chaikin(simplifyRdp(poly, 8), 1, true);
    if (polygonArea(poly) < minArea) continue;
    out.push(poly);
  }
  return out;
}

function lakeFromBasin(hGrid, gridW, gridH, basinCx, basinCy) {
  let minH = Infinity;
  for (let j = 0; j <= gridH; j++) {
    for (let i = 0; i <= gridW; i++) {
      const x = (i / gridW) * WIDTH;
      const y = (j / gridH) * HEIGHT;
      if ((x - basinCx) ** 2 + (y - basinCy) ** 2 < 380 ** 2) {
        minH = Math.min(minH, hGrid[j][i]);
      }
    }
  }
  const waterLevel = minH + 0.028;
  const loops = closedLoopsAtLevel(hGrid, gridW, gridH, waterLevel, 12000);
  for (const poly of loops.sort((a, b) => polygonArea(b) - polygonArea(a))) {
    if (pointInPolygon(basinCx, basinCy, poly)) {
      return { lakePts: poly, waterLevel };
    }
  }
  return {
    lakePts: perturbedPatch(basinCx, basinCy, 200, 150, 0.15, 404),
    waterLevel,
  };
}

function processContourLine(poly, closed) {
  poly = simplifyRdp(poly, 7);
  if (closed) poly = chaikin(poly, 1, true);
  return poly;
}

function clipFromCircle(center, r, toward) {
  const dx = toward[0] - center[0];
  const dy = toward[1] - center[1];
  const len = Math.hypot(dx, dy) || 1;
  return [center[0] + (dx / len) * r, center[1] + (dy / len) * r];
}

function clipToCircle(center, r, from) {
  const dx = center[0] - from[0];
  const dy = center[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [center[0] - (dx / len) * r, center[1] - (dy / len) * r];
}

function segmentIntersect(a, b, c, d) {
  const denom = (a[0] - b[0]) * (c[1] - d[1]) - (a[1] - b[1]) * (c[0] - d[0]);
  if (Math.abs(denom) < 1e-9) return null;
  const t =
    ((a[0] - c[0]) * (c[1] - d[1]) - (a[1] - c[1]) * (c[0] - d[0])) / denom;
  if (t < 0 || t > 1) return null;
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
}

function triangleExitPoint(apex, bl, br, target) {
  const baseMid = [(bl[0] + br[0]) / 2, (bl[1] + br[1]) / 2];
  return baseMid;
}

/** Equilateral start triangle (701): centroid at start, apex toward first control. */
function startTriangleToward(start, control1, sidePx) {
  const side = sidePx;
  const h = side * (Math.sqrt(3) / 2);
  const dx = control1[0] - start[0];
  const dy = control1[1] - start[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const apex = [start[0] + ux * ((2 * h) / 3), start[1] + uy * ((2 * h) / 3)];
  const baseMid = [start[0] - ux * (h / 3), start[1] - uy * (h / 3)];
  const bl = [baseMid[0] + px * (side / 2), baseMid[1] + py * (side / 2)];
  const br = [baseMid[0] - px * (side / 2), baseMid[1] - py * (side / 2)];
  return { apex, bl, br, baseMid };
}

function distPointToSegment(p, a, b) {
  const ab2 = dist2(a, b) || 1;
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / ab2),
  );
  const proj = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  return Math.hypot(p[0] - proj[0], p[1] - proj[1]);
}

function minDistToLegs(point, legs) {
  let min = Infinity;
  for (const [a, b] of legs) {
    min = Math.min(min, distPointToSegment(point, a, b));
  }
  return min;
}

function controlLabelPos(center, legs, controlR) {
  const offsets = [
    [controlR + 48, 0],
    [-controlR - 52, 0],
    [0, -controlR - 40],
    [0, controlR + 48],
    [controlR + 36, -controlR - 32],
    [-controlR - 36, controlR + 32],
    [-controlR - 40, -controlR - 20],
    [controlR + 40, controlR + 24],
  ];
  let best = offsets[0];
  let bestScore = -Infinity;
  for (const [ox, oy] of offsets) {
    const px = center[0] + ox;
    const py = center[1] + oy;
    const score = minDistToLegs([px, py], legs);
    if (score > bestScore) {
      bestScore = score;
      best = [ox, oy];
    }
  }
  return [center[0] + best[0] - 12, center[1] + best[1] + 14];
}

function northLakeShorePoint(lakePoly) {
  let best = lakePoly[0];
  for (const p of lakePoly) {
    if (p[1] < best[1]) best = p;
  }
  return best;
}

function landClipPathDef(lakePoly) {
  const hole = lakePoly
    .map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`)
    .join(" ");
  return `<defs><clipPath id="landClip"><path clip-rule="evenodd" fill-rule="evenodd" d="M0,0 H${WIDTH} V${HEIGHT} H0 Z ${hole} Z"/></clipPath></defs>`;
}

function lakeShorePoint(lakePoly, preferY, preferX) {
  let best = lakePoly[0];
  let bestScore = Infinity;
  for (let i = 0; i < lakePoly.length; i++) {
    const p = lakePoly[i];
    const score = Math.abs(p[1] - preferY) + Math.abs(p[0] - preferX) * 0.3;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

function touchesMapEdge(poly, margin = 10) {
  for (const p of poly) {
    if (p[0] <= margin || p[0] >= WIDTH - margin || p[1] <= margin || p[1] >= HEIGHT - margin) {
      return true;
    }
  }
  return false;
}

function closedLoopEnclosesLake(poly, lakeCx, lakeCy) {
  return pointInPolygon(lakeCx, lakeCy, poly);
}

function distSegmentToPoint(a, b, p) {
  return distPointToSegment(p, a, b);
}

function buildLegSegments(course, controls, finish, start, triApex, triBl, triBr, controlR, finishOuterR) {
  const legSegments = [];
  for (let i = 0; i < course.length - 1; i++) {
    const from = course[i];
    const to = course[i + 1];
    let p0;
    let p1;
    if (i === 0) {
      p0 = triangleExitPoint(triApex, triBl, triBr, controls[0]);
      p1 = clipToCircle(controls[0], controlR, p0);
    } else if (i === course.length - 2) {
      p0 = clipFromCircle(from, controlR, finish);
      p1 = clipToCircle(finish, finishOuterR, p0);
    } else {
      p0 = clipFromCircle(from, controlR, to);
      p1 = clipToCircle(to, controlR, p0);
    }
    legSegments.push({ p0, p1 });
  }
  return legSegments;
}

function validateControlLabels(controls, legSegments, controlR, labelPositions) {
  for (const { x, y, num, center } of labelPositions) {
    for (let li = 0; li < legSegments.length; li++) {
      const leg = legSegments[li];
      if (distPointToSegment([x, y], leg.p0, leg.p1) < 18) {
        throw new Error(`Control ${num} label overlaps leg ${li + 1}`);
      }
    }
    if (Math.hypot(x - center[0], y - center[1]) < controlR + 8) {
      throw new Error(`Control ${num} label overlaps its circle`);
    }
  }
}

function pathClearOfLake(waypoints, lakePoly) {
  return waypoints.every((p) => !pointInPolygon(p[0], p[1], lakePoly));
}

/** Authored map geometry (terrain/water/roads unchanged unless a point feature hosts a control). */
const MAP_BASIN = { cx: 1150, cy: 1140 };
const ROAD_PTS = [
  [140, 920],
  [360, 890],
  [580, 860],
  [820, 835],
  [1060, 815],
  [1300, 798],
  [1540, 785],
  [1780, 775],
  [2020, 768],
  [2280, 762],
];
const TRACK_A = [
  [820, 835],
  [700, 720],
  [580, 620],
  [480, 520],
];
const TRACK_B = [
  [1300, 798],
  [1420, 720],
  [1540, 660],
  [1660, 620],
];
const TRACK_C = [
  [1060, 815],
  [980, 720],
  [900, 640],
];
const SMALL_PATH_A = [
  [360, 890],
  [300, 960],
  [260, 1040],
];
const SMALL_PATH_B = [
  [1660, 620],
  [1740, 680],
  [1800, 760],
];
const PATH_TO_BUILDINGS = [
  [1780, 775],
  [1840, 820],
  [1880, 860],
];
const BUILDINGS = [
  [1868, 848, 34, 28],
  [1920, 868, 28, 24],
  [848, 808, 32, 26],
];
const BOULDERS = [
  [680, 340],
  [710, 365],
  [560, 450],
  [1750, 560],
  [1780, 590],
  [1690, 1280],
  [1720, 1310],
  [820, 640],
];
const KNOLLS = [
  [620, 340],
  [1820, 440],
  [1720, 1320],
];
const VEG_PATCH_FOR_CONTROL = { cx: 900, cy: 470, rx: 82, ry: 52, rot: 0.55, salt: 603 };

/** IOF Foot-O Competition Rules 19.4 @ 1:10000 (100 px = 100 m on ground → 1 px ≈ 1 m). */
const IOF_MIN_CONTROL_SEP_PX = 30;
const IOF_SIMILAR_CONTROL_SEP_PX = 60;
const GUIDELINE_LEG_NEAR_CONTROL_PX = CONTROL_R + 30;
const GUIDELINE_DOGLEG_MIN_DEG = 35;
const SYMBOL_EDGE_GAP_PX = 30;
/** Equilateral triangle: centroid to vertex ≈ side / √3. */
const START_SYMBOL_OUTER_R = START_TRI_SIDE / Math.sqrt(3);
const GUIDELINE_LEG_OVERLAP_PX = 25;
const GUIDELINE_LEG_OVERLAP_MIN_LEN = 80;

function inflowWaypoints(lakePts) {
  const inflowShore = northLakeShorePoint(lakePts);
  const wps = [
    [1160, 140],
    [1225, 280],
    [1155, 430],
    [1105, 580],
    [1135, 720],
    [1095, 860],
    [1100, 960],
    [1105, 1040],
  ].filter(([, y]) => y < inflowShore[1] - 60);
  wps.push([inflowShore[0], inflowShore[1] - 35], [inflowShore[0], inflowShore[1]]);
  return { inflowShore, inflowBody: wps.slice(0, -1), inflowWps: wps };
}

function vegPatchCorner(patch, vertexIndex) {
  const poly = irregularPatch(patch.cx, patch.cy, patch.rx, patch.ry, patch.rot, patch.salt, {
    a2: 0.12,
    a3: 0.07,
    phi2: patch.rot,
  });
  return poly[vertexIndex % poly.length].slice();
}

function lakeShoreWest(lakePts) {
  let best = null;
  let bestX = Infinity;
  for (const p of lakePts) {
    if (p[1] < 1000) continue;
    if (p[0] < bestX) {
      bestX = p[0];
      best = p;
    }
  }
  return best ?? lakeShorePoint(lakePts, MAP_BASIN.cy + 60, MAP_BASIN.cx - 120);
}

function buildingCorner(rect, corner) {
  const [x, y, w, h] = rect;
  if (corner === "ne") return [x + w, y];
  if (corner === "nw") return [x, y];
  if (corner === "se") return [x + w, y + h];
  return [x, y + h];
}

function distPx(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function angleBetween(ax, ay, bx, by) {
  const la = Math.hypot(ax, ay);
  const lb = Math.hypot(bx, by);
  if (la < 1e-6 || lb < 1e-6) return 180;
  let c = (ax * bx + ay * by) / (la * lb);
  c = Math.max(-1, Math.min(1, c));
  return (Math.acos(c) * 180) / Math.PI;
}

function distPointToPolyline(p, poly) {
  let min = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    min = Math.min(min, distPointToSegment(p, poly[i], poly[i + 1]));
  }
  return min;
}

function legMostlyOnRoad(p0, p1, roadPoly, threshold = 22) {
  const steps = 12;
  let on = 0;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
    if (distPointToPolyline(p, roadPoly) <= threshold) on++;
  }
  return on >= steps - 1;
}

/**
 * Control positions with ISCD column D/G metadata (ISCD 2018 describes location; it is not a
 * placement rulebook — IOF Foot-O 19.4 spacing is validated separately).
 */
function planSampleCourse(lakePts) {
  const streamBend = [1095, 860];
  const vegCorner = vegPatchCorner(VEG_PATCH_FOR_CONTROL, 2).map((v) => fmtCoord(v));
  const bldg = BUILDINGS[2];

  const start = {
    code: "S",
    featureD: "5.4.1 Path junction",
    locationG: null,
    featureId: "path-junction-360-890",
    featureType: "man-made",
    position: [360, 890],
  };

  const controls = [
    {
      number: 1,
      code: "31",
      featureD: "1.11 Knoll",
      locationG: "top",
      featureId: "knoll-620-340",
      featureType: "landform",
      position: [620, 340],
    },
    {
      number: 2,
      code: "47",
      featureD: "2.1 Boulder",
      locationG: "east side",
      featureId: "boulder-820-640",
      featureType: "rock",
      position: [820, 640],
    },
    {
      number: 3,
      code: "51",
      featureD: "5.11 Building",
      locationG: "north-east corner",
      featureId: "building-848-808",
      featureType: "man-made",
      position: buildingCorner(bldg, "ne"),
    },
    {
      number: 4,
      code: "63",
      featureD: "3.2 Stream",
      locationG: "bend",
      featureId: "stream-1095-860",
      featureType: "water",
      position: streamBend,
    },
    {
      number: 5,
      code: "78",
      featureD: "4.2 Vegetation boundary",
      locationG: "north corner",
      featureId: "veg-900-470",
      featureType: "vegetation",
      position: vegCorner,
    },
    {
      number: 6,
      code: "84",
      featureD: "1.11 Knoll",
      locationG: "top",
      featureId: "knoll-1820-440",
      featureType: "landform",
      position: [1820, 440],
    },
    {
      number: 7,
      code: "42",
      featureD: "1.11 Knoll",
      locationG: "south side",
      featureId: "knoll-1720-1320",
      featureType: "landform",
      position: [1720, 1320],
    },
  ];

  const finish = {
    code: "F",
    featureD: "5.4 Footpath",
    locationG: "junction",
    featureId: "path-end-260-1040",
    featureType: "man-made",
    position: [260, 1040],
  };

  return { start, controls, finish };
}

function courseSymbolRadii(plan) {
  return [
    { label: "Start", position: plan.start.position, outerR: START_SYMBOL_OUTER_R },
    ...plan.controls.map((c) => ({
      label: `Control ${c.number}`,
      position: c.position,
      outerR: CONTROL_R,
    })),
    { label: "Finish", position: plan.finish.position, outerR: FINISH_OUTER_R },
  ];
}

/** Minimum gap between overprint symbol outlines (sample map layout). */
function validateCourseSymbolClearance(plan) {
  const symbols = courseSymbolRadii(plan);
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const d = distPx(symbols[i].position, symbols[j].position);
      const need = symbols[i].outerR + symbols[j].outerR + SYMBOL_EDGE_GAP_PX;
      if (d < need) {
        throw new Error(
          `Course symbols ${symbols[i].label} and ${symbols[j].label}: edge gap ${(d - symbols[i].outerR - symbols[j].outerR).toFixed(1)} px (< ${SYMBOL_EDGE_GAP_PX} px)`,
        );
      }
    }
  }
}

function segmentOverlapLengthOnOther(p0, p1, q0, q1, threshold) {
  const steps = 24;
  let len = 0;
  const segLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / steps;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
    if (distPointToSegment(p, q0, q1) < threshold) len += segLen;
  }
  return len;
}

function similarControlFeatures(a, b) {
  return a.featureType === b.featureType;
}

/** IOF Foot Orienteering Competition Rules 19.4 (1:10000: 100 px = 100 m). */
function validateIofFootOControlSpacing(plan) {
  const markers = [
    { label: "Start", ...plan.start },
    ...plan.controls.map((c) => ({ label: `Control ${c.number}`, ...c })),
    { label: "Finish", ...plan.finish },
  ];
  for (let i = 0; i < markers.length; i++) {
    for (let j = i + 1; j < markers.length; j++) {
      const d = distPx(markers[i].position, markers[j].position);
      const similar = similarControlFeatures(markers[i], markers[j]);
      const minSep = similar ? IOF_SIMILAR_CONTROL_SEP_PX : IOF_MIN_CONTROL_SEP_PX;
      if (d < minSep) {
        const similarNote = similar ? " (similar feature types)" : "";
        throw new Error(
          `IOF Foot-O 19.4: ${markers[i].label} and ${markers[j].label} are ${d.toFixed(1)} m apart; minimum ${minSep} m${similarNote}`,
        );
      }
    }
  }
}

/**
 * Course-planning guidelines (not IOF/ISCD rules). Warn only — sample map layout quality.
 */
function checkCourseDesignGuidelines(plan, legSegments) {
  const warnings = [];
  const controlPts = plan.controls.map((c) => c.position);

  for (let li = 0; li < legSegments.length; li++) {
    const leg = legSegments[li];
    const skip = new Set();
    if (li === 0) skip.add(0);
    else if (li === legSegments.length - 1) skip.add(plan.controls.length - 1);
    else {
      skip.add(li - 1);
      skip.add(li);
    }
    for (let ci = 0; ci < plan.controls.length; ci++) {
      if (skip.has(ci)) continue;
      const d = distSegmentToPoint(leg.p0, leg.p1, controlPts[ci]);
      if (d < GUIDELINE_LEG_NEAR_CONTROL_PX) {
        warnings.push(
          `Leg ${li + 1} passes within ${GUIDELINE_LEG_NEAR_CONTROL_PX.toFixed(0)} m of control ${plan.controls[ci].number} (d=${d.toFixed(1)} m)`,
        );
      }
    }
  }

  const coursePts = [plan.start.position, ...controlPts, plan.finish.position];
  for (let i = 1; i < coursePts.length - 2; i++) {
    const prev = coursePts[i - 1];
    const cur = coursePts[i];
    const next = coursePts[i + 1];
    const inx = cur[0] - prev[0];
    const iny = cur[1] - prev[1];
    const outx = next[0] - cur[0];
    const outy = next[1] - cur[1];
    const turn = angleBetween(-inx, -iny, outx, outy);
    if (turn < GUIDELINE_DOGLEG_MIN_DEG) {
      warnings.push(
        `Possible dog-leg at control ${i} (turn ${turn.toFixed(1)}° < ${GUIDELINE_DOGLEG_MIN_DEG}° guideline)`,
      );
    }
  }

  for (let li = 0; li < legSegments.length; li++) {
    const { p0, p1 } = legSegments[li];
    const legLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    if (legLen > 150 && legMostlyOnRoad(p0, p1, ROAD_PTS)) {
      warnings.push(`Leg ${li + 1} follows the road for most of its length`);
    }
  }

  for (let a = 0; a < legSegments.length; a++) {
    for (let b = a + 2; b < legSegments.length; b++) {
      if (b === a + 1) continue;
      const la = legSegments[a];
      const lb = legSegments[b];
      const overlap = segmentOverlapLengthOnOther(
        la.p0,
        la.p1,
        lb.p0,
        lb.p1,
        GUIDELINE_LEG_OVERLAP_PX,
      );
      if (overlap >= GUIDELINE_LEG_OVERLAP_MIN_LEN) {
        warnings.push(
          `Legs ${a + 1} and ${b + 1} run within ${GUIDELINE_LEG_OVERLAP_PX} m of each other for ~${overlap.toFixed(0)} m`,
        );
      }
    }
  }

  return warnings;
}

function validateCoursePlanning(plan, legSegments, controlR, labelPositions) {
  validateIofFootOControlSpacing(plan);
  validateCourseSymbolClearance(plan);
  validateControlLabels(plan.controls.map((c) => c.position), legSegments, controlR, labelPositions);
  const guidelines = checkCourseDesignGuidelines(plan, legSegments);
  for (const msg of guidelines) {
    console.warn(`Course design guideline: ${msg}`);
  }
}

function fmtCoord(n) {
  return Number(n.toFixed(1));
}

function fmtPt(p) {
  return [fmtCoord(p[0]), fmtCoord(p[1])];
}

function exportSampleCourseJson(plan, lakePts) {
  const { inflowWps, inflowBody } = inflowWaypoints(lakePts);
  const outflowShore = lakeShorePoint(lakePts, MAP_BASIN.cy + 130, MAP_BASIN.cx);
  const outflowWps = [
    [outflowShore[0], outflowShore[1]],
    [1135, 1410],
    [1115, 1550],
    [1095, 1675],
  ];

  const payload = {
    finish: {
      code: plan.finish.code,
      featureD: plan.finish.featureD,
      locationG: plan.finish.locationG,
      position: fmtPt(plan.finish.position),
    },
    geometry: {
      buildings: BUILDINGS.map(([x, y, w, h]) => ({
        height: h,
        width: w,
        x: fmtCoord(x),
        y: fmtCoord(y),
      })),
      boulders: BOULDERS.map((p) => fmtPt(p)),
      knolls: KNOLLS.map((p) => fmtPt(p)),
      lakeOutline: lakePts.map((p) => fmtPt(p)),
      paths: {
        pathToBuildings: PATH_TO_BUILDINGS.map((p) => fmtPt(p)),
        smallPathA: SMALL_PATH_A.map((p) => fmtPt(p)),
        smallPathB: SMALL_PATH_B.map((p) => fmtPt(p)),
      },
      road: ROAD_PTS.map((p) => fmtPt(p)),
      stream: {
        inflow: inflowBody.map((p) => fmtPt(p)),
        inflowToLake: inflowWps.map((p) => fmtPt(p)),
        outflow: outflowWps.map((p) => fmtPt(p)),
      },
      tracks: {
        trackA: TRACK_A.map((p) => fmtPt(p)),
        trackB: TRACK_B.map((p) => fmtPt(p)),
        trackC: TRACK_C.map((p) => fmtPt(p)),
      },
    },
    mapScale: "1:10000",
    start: {
      code: plan.start.code,
      featureD: plan.start.featureD,
      locationG: plan.start.locationG,
      position: fmtPt(plan.start.position),
    },
    controls: plan.controls.map((c) => ({
      code: c.code,
      featureD: c.featureD,
      locationG: c.locationG,
      number: c.number,
      position: fmtPt(c.position),
    })),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/** Filled by buildSvg for verification crops and JSON export. */
let lastCoursePlan = null;
let lastLakePts = null;

function buildSvg() {
  const basinCx = MAP_BASIN.cx;
  const basinCy = MAP_BASIN.cy;
  const hGrid = smoothGrid(
    sampleGrid(authoredHeight, HEIGHT_GRID_W, HEIGHT_GRID_H),
    HEIGHT_GRID_W,
    HEIGHT_GRID_H,
    3,
  );
  const { lakePts } = lakeFromBasin(hGrid, HEIGHT_GRID_W, HEIGHT_GRID_H, basinCx, basinCy);
  lastLakePts = lakePts;
  const coursePlan = planSampleCourse(lakePts);
  lastCoursePlan = coursePlan;

  let hMin = Infinity;
  let hMax = -Infinity;
  for (const row of hGrid) {
    for (const v of row) {
      if (v < hMin) hMin = v;
      if (v > hMax) hMax = v;
    }
  }
  const levelCount = 18;
  const levels = [];
  for (let i = 1; i < levelCount; i++) {
    levels.push(hMin + ((hMax - hMin) * i) / levelCount);
  }

  const parts = [];
  parts.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="${ISOM.WHITE}"/>`);
  parts.push(landClipPathDef(lakePts));
  parts.push(`<g clip-path="url(#landClip)">`);

  const openPatches = [
    { cx: 760, cy: 860, rx: 165, ry: 95, rot: -0.12, rough: true },
    { cx: 760, cy: 860, rx: 130, ry: 72, rot: -0.12, rough: false },
    { cx: 1760, cy: 430, rx: 120, ry: 85, rot: 0.35, rough: false },
    { cx: 520, cy: 540, rx: 95, ry: 70, rot: 0.1, rough: false },
  ];

  const vegPatches = [
    { cx: 1260, cy: 740, rx: 280, ry: 58, rot: 0.52, color: ISOM.GREEN_30, a2: 0.1, phi2: 0.2 },
    { cx: 1310, cy: 810, rx: 210, ry: 48, rot: 0.48, color: ISOM.GREEN_30 },
    { cx: 1180, cy: 880, rx: 150, ry: 44, rot: 0.45, color: ISOM.GREEN_30 },
    { cx: 1000, cy: 1010, rx: 130, ry: 72, rot: 0.2, color: ISOM.GREEN_30 },
    {
      cx: 540,
      cy: 710,
      rx: 118,
      ry: 78,
      rot: -0.35,
      color: ISOM.GREEN_30,
      core: ISOM.GREEN_50,
      coreScale: 0.58,
    },
    { cx: 1860, cy: 870, rx: 105, ry: 68, rot: 0.25, color: ISOM.GREEN_50 },
    { cx: 1460, cy: 510, rx: 92, ry: 62, rot: 0.12, color: ISOM.GREEN_30 },
    {
      cx: 900,
      cy: 470,
      rx: 82,
      ry: 52,
      rot: 0.55,
      color: ISOM.GREEN_30,
      core: ISOM.GREEN,
      coreScale: 0.48,
    },
    { cx: 1220, cy: 1260, rx: 105, ry: 58, rot: -0.15, color: ISOM.GREEN_30 },
    { cx: 660, cy: 960, rx: 98, ry: 52, rot: 0.55, color: ISOM.GREEN_50 },
  ];

  for (const p of openPatches.filter((o) => o.rough)) {
    const poly = irregularPatch(p.cx, p.cy, p.rx + 20, p.ry + 14, p.rot, 501, { a2: 0.16, a3: 0.1 });
    if (!pointInPolygon(p.cx, p.cy, lakePts)) {
      parts.push(`<path d="${polylinePath(poly, true)}" fill="${ISOM.YELLOW_50}" stroke="none"/>`);
    }
  }
  for (const p of openPatches.filter((o) => !o.rough)) {
    const poly = irregularPatch(p.cx, p.cy, p.rx, p.ry, p.rot, 502, {
      a2: 0.12,
      a3: 0.07,
      phi2: p.rot,
    });
    if (!pointInPolygon(p.cx, p.cy, lakePts)) {
      parts.push(`<path d="${polylinePath(poly, true)}" fill="${ISOM.YELLOW}" stroke="none"/>`);
    }
  }
  for (const p of vegPatches) {
    if (pointInPolygon(p.cx, p.cy, lakePts)) continue;
    const outer = irregularPatch(p.cx, p.cy, p.rx, p.ry, p.rot, 601 + p.cx, {
      a2: p.a2 ?? 0.15,
      a3: 0.08,
      phi2: p.phi2 ?? p.rot,
    });
    parts.push(`<path d="${polylinePath(outer, true)}" fill="${p.color}" stroke="none"/>`);
    if (p.core) {
      const inner = irregularPatch(p.cx, p.cy, p.rx, p.ry, p.rot, 701 + p.cx, {
        scale: p.coreScale ?? 0.55,
        a2: 0.1,
        a3: 0.06,
      });
      parts.push(`<path d="${polylinePath(inner, true)}" fill="${p.core}" stroke="none"/>`);
    }
  }
  parts.push(`</g>`);

  parts.push(
    `<polygon points="${polygonPoints(lakePts)}" fill="${ISOM.BLUE_50}" stroke="none"/>`,
  );

  parts.push(`<g ${MULTIPLY}>`);

  function intersectsLake(poly) {
    for (const p of poly) {
      if (pointInPolygon(p[0], p[1], lakePts)) return true;
    }
    return false;
  }

  for (let li = 0; li < levels.length; li++) {
    const level = levels[li];
    const segs = contourSegmentsOnGrid(hGrid, HEIGHT_GRID_W, HEIGHT_GRID_H, level, WIDTH, HEIGHT);
    const lines = joinSegments(segs);
    const isIndex = (li + 1) % 5 === 0;
    const strokeW = isIndex ? STROKE.contourIndex : STROKE.contour;
    for (let poly of lines) {
      const gap = Math.hypot(
        poly[0][0] - poly[poly.length - 1][0],
        poly[0][1] - poly[poly.length - 1][1],
      );
      const closed = gap < 28;
      if (closed) {
        if (polylineLength(poly, true) < 200) continue;
        if (closedLoopEnclosesLake(poly, basinCx, basinCy)) continue;
      } else {
        if (polylineLength(poly) < 160) continue;
        if (!touchesMapEdge(poly)) continue;
      }
      poly = processContourLine(poly, closed);
      if (intersectsLake(poly)) continue;
      parts.push(
        `<path d="${polylinePath(poly, closed)}" fill="none" stroke="${ISOM.BROWN}" stroke-width="${strokeW}" stroke-linejoin="round" stroke-linecap="round"/>`,
      );
    }
  }

  for (let x = 125; x < WIDTH; x += 250) {
    parts.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${HEIGHT}" stroke="${ISOM.BLUE_30}" stroke-width="${STROKE.northLine}"/>`,
    );
  }

  parts.push(
    `<polygon points="${polygonPoints(lakePts)}" fill="none" stroke="${ISOM.BLUE}" stroke-width="${STROKE.stream}"/>`,
  );

  const { inflowShore, inflowBody, inflowWps } = inflowWaypoints(lakePts);
  const inflowD = `${catmullRomPath(inflowBody)} L${inflowShore[0].toFixed(1)},${inflowShore[1].toFixed(1)}`;
  parts.push(
    `<path d="${inflowD}" fill="none" stroke="${ISOM.BLUE}" stroke-width="${STROKE.stream}" stroke-linecap="round"/>`,
  );

  const outflowShore = lakeShorePoint(lakePts, basinCy + 130, basinCx);
  const outflowWps = [
    [outflowShore[0], outflowShore[1]],
    [1135, 1410],
    [1115, 1550],
    [1095, 1675],
  ];
  parts.push(
    `<path d="${catmullRomPath(outflowWps)}" fill="none" stroke="${ISOM.BLUE}" stroke-width="${STROKE.stream}" stroke-linecap="round"/>`,
  );

  let marshY = inflowShore[1] - 32;
  const marshCx = inflowShore[0] - 38;
  while (marshY > 40 && pointInPolygon(marshCx, marshY, lakePts)) {
    marshY -= 10;
  }
  for (let mx = marshCx - 55; mx < marshCx + 45; mx += 22) {
    if (pointInPolygon(mx, marshY, lakePts)) continue;
    parts.push(
      `<line x1="${mx.toFixed(0)}" y1="${marshY.toFixed(0)}" x2="${(mx + 14).toFixed(0)}" y2="${marshY.toFixed(0)}" stroke="${ISOM.BLUE}" stroke-width="${STROKE.marshDash}" stroke-linecap="round"/>`,
    );
  }

  const roadPts = ROAD_PTS;
  const roadD = catmullRomPath(roadPts);
  const roadHalf = ROAD_FILL_W / 2;
  parts.push(
    `<path d="${roadD}" fill="none" stroke="${ISOM.BROWN_50}" stroke-width="${ROAD_FILL_W}" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
  parts.push(
    `<path d="${catmullRomPath(offsetPolyline(roadPts, roadHalf))}" fill="none" stroke="${ISOM.BLACK}" stroke-width="${STROKE.roadOutline}" stroke-linecap="round"/>`,
  );
  parts.push(
    `<path d="${catmullRomPath(offsetPolyline(roadPts, -roadHalf))}" fill="none" stroke="${ISOM.BLACK}" stroke-width="${STROKE.roadOutline}" stroke-linecap="round"/>`,
  );

  const trackA = TRACK_A;
  const trackB = TRACK_B;
  const trackC = TRACK_C;
  for (const t of [trackA, trackB, trackC]) {
    if (pathClearOfLake(t, lakePts)) {
      parts.push(
        `<path d="${catmullRomPath(t)}" fill="none" stroke="${ISOM.BLACK}" stroke-width="${STROKE.track}" stroke-linecap="round"/>`,
      );
    }
  }

  const lakeShorePath = [
    [920, 1060],
    [980, 980],
    [1040, 940],
    [1100, 920],
    [1160, 918],
    [1220, 940],
    [1280, 990],
    [1320, 1060],
  ].filter((p) => !pointInPolygon(p[0], p[1], lakePts));
  parts.push(
    `<path d="${catmullRomPath(lakeShorePath)}" fill="none" stroke="${ISOM.BLACK}" stroke-width="${STROKE.path}" stroke-dasharray="${(STROKE.path * 4).toFixed(1)} ${(STROKE.path * 3.6).toFixed(1)}" stroke-linecap="round"/>`,
  );

  const smallPathA = SMALL_PATH_A;
  const smallPathB = SMALL_PATH_B;
  for (const p of [smallPathA, smallPathB]) {
    if (pathClearOfLake(p, lakePts)) {
      parts.push(
        `<path d="${catmullRomPath(p)}" fill="none" stroke="${ISOM.BLACK}" stroke-width="${STROKE.path}" stroke-dasharray="${(STROKE.path * 3.2).toFixed(1)} ${(STROKE.path * 3.2).toFixed(1)}" stroke-linecap="round"/>`,
      );
    }
  }

  const pathToBuildings = PATH_TO_BUILDINGS;
  if (pathClearOfLake(pathToBuildings, lakePts)) {
    parts.push(
      `<path d="${catmullRomPath(pathToBuildings)}" fill="none" stroke="${ISOM.BLACK}" stroke-width="${STROKE.path}" stroke-linecap="round"/>`,
    );
  }

  const buildings = BUILDINGS;
  for (const [bx, by, bw, bh] of buildings) {
    parts.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="${ISOM.BLACK}"/>`);
  }

  const boulders = BOULDERS;
  for (const [bx, by] of boulders) {
    parts.push(`<circle cx="${bx}" cy="${by}" r="${STROKE.path}" fill="${ISOM.BLACK}"/>`);
  }

  const knolls = KNOLLS;
  for (const [kx, ky] of knolls) {
    parts.push(`<circle cx="${kx}" cy="${ky}" r="${STROKE.contourIndex}" fill="${ISOM.BROWN}"/>`);
  }

  const cliffPts = [
    [520, 460],
    [560, 520],
    [600, 580],
    [640, 640],
  ];
  parts.push(
    `<path d="${catmullRomPath(cliffPts)}" fill="none" stroke="${ISOM.BLACK}" stroke-width="${STROKE.track}" stroke-linecap="round"/>`,
  );
  for (let ci = 0; ci < cliffPts.length - 1; ci++) {
    const p = cliffPts[ci];
    const q = cliffPts[ci + 1];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    const tx = (-dy / len) * 12;
    const ty = (dx / len) * 12;
    parts.push(
      `<line x1="${(p[0] + tx).toFixed(1)}" y1="${(p[1] + ty).toFixed(1)}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="${ISOM.BLACK}" stroke-width="${STROKE.path}"/>`,
    );
  }

  const cliffPts2 = [
    [1760, 520],
    [1720, 580],
    [1680, 640],
  ];
  parts.push(
    `<path d="${catmullRomPath(cliffPts2)}" fill="none" stroke="${ISOM.BLACK}" stroke-width="${STROKE.track}" stroke-linecap="round"/>`,
  );
  for (const p of cliffPts2) {
    parts.push(
      `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${(p[0] + 10).toFixed(1)}" y2="${(p[1] + 12).toFixed(1)}" stroke="${ISOM.BLACK}" stroke-width="${STROKE.path}"/>`,
    );
  }

  parts.push(`</g>`);

  const overprint = ISOM.PURPLE;
  const legStroke = STROKE.overprint;

  const start = coursePlan.start.position;
  const controls = coursePlan.controls.map((c) => c.position);
  const finish = coursePlan.finish.position;
  const course = [start, ...controls, finish];

  const { apex: triApex, bl: triBl, br: triBr } = startTriangleToward(start, controls[0], START_TRI_SIDE);

  const controlR = CONTROL_R;
  const finishOuterR = FINISH_OUTER_R;
  const innerFinishR = FINISH_INNER_R;

  const legSegments = buildLegSegments(
    course,
    controls,
    finish,
    start,
    triApex,
    triBl,
    triBr,
    controlR,
    finishOuterR,
  );

  const labelPositions = controls.map((c, idx) => {
    const num = idx + 1;
    const [tx, ty] = controlLabelPos(c, legSegments.map((l) => [l.p0, l.p1]), controlR);
    return { x: tx, y: ty, num, center: c };
  });
  validateCoursePlanning(coursePlan, legSegments, controlR, labelPositions);

  parts.push(`<g ${MULTIPLY}>`);
  for (const leg of legSegments) {
    parts.push(
      `<path d="M${leg.p0[0].toFixed(1)},${leg.p0[1].toFixed(1)} L${leg.p1[0].toFixed(1)},${leg.p1[1].toFixed(1)}" fill="none" stroke="${overprint}" stroke-width="${legStroke}" stroke-linecap="round"/>`,
    );
  }

  parts.push(
    `<polygon points="${triApex[0].toFixed(1)},${triApex[1].toFixed(1)} ${triBl[0].toFixed(1)},${triBl[1].toFixed(1)} ${triBr[0].toFixed(1)},${triBr[1].toFixed(1)}" fill="none" stroke="${overprint}" stroke-width="${legStroke}" stroke-linejoin="round"/>`,
  );

  controls.forEach((c, idx) => {
    const num = idx + 1;
    const { x: tx, y: ty } = labelPositions[idx];
    parts.push(
      `<circle cx="${c[0]}" cy="${c[1]}" r="${controlR}" fill="none" stroke="${overprint}" stroke-width="${legStroke}"/>`,
    );
    parts.push(
      `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" font-family="Arial, Helvetica, sans-serif" font-size="${CONTROL_NUM_PX}" font-weight="bold" fill="${overprint}">${num}</text>`,
    );
  });

  parts.push(
    `<circle cx="${finish[0]}" cy="${finish[1]}" r="${finishOuterR}" fill="none" stroke="${overprint}" stroke-width="${legStroke}"/>`,
    `<circle cx="${finish[0]}" cy="${finish[1]}" r="${innerFinishR}" fill="none" stroke="${overprint}" stroke-width="${legStroke}"/>`,
  );
  parts.push(`</g>`);

  const label = "O-Route サンプル地図（架空）";
  const labelX = 40;
  const labelY = HEIGHT - 44;
  parts.push(
    `<rect x="${labelX}" y="${labelY - 48}" width="480" height="56" fill="${ISOM.WHITE}" stroke="#CCCCCC" stroke-width="1"/>`,
    `<text x="${labelX + 14}" y="${labelY}" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="${ISOM.BLACK}">${escapeXml(label)}</text>`,
  );

  const scaleX = WIDTH - 320;
  const scaleY = HEIGHT - 48;
  const scaleLen = SCALE_BAR_PX;
  parts.push(
    `<rect x="${scaleX - 10}" y="${scaleY - 36}" width="${scaleLen + 80}" height="40" fill="${ISOM.WHITE}"/>`,
    `<line x1="${scaleX}" y1="${scaleY}" x2="${scaleX + scaleLen}" y2="${scaleY}" stroke="${ISOM.BLACK}" stroke-width="${STROKE.contourIndex}"/>`,
    `<line x1="${scaleX}" y1="${scaleY - 8}" x2="${scaleX}" y2="${scaleY + 8}" stroke="${ISOM.BLACK}" stroke-width="${STROKE.contour}"/>`,
    `<line x1="${scaleX + scaleLen}" y1="${scaleY - 8}" x2="${scaleX + scaleLen}" y2="${scaleY + 8}" stroke="${ISOM.BLACK}" stroke-width="${STROKE.contour}"/>`,
    `<text x="${scaleX + scaleLen / 2 - 36}" y="${scaleY - 14}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="${ISOM.BLACK}">100 m</text>`,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
${parts.join("\n")}
</svg>`;
}

async function captureVerificationCrops(page) {
  const outDir = join(OUT_DIR, "..", "..", "test-results", "map-verify");
  mkdirSync(outDir, { recursive: true });
  const crops = [
    { name: "start-triangle", x: 260, y: 790, width: 220, height: 220 },
    { name: "control-1-knoll", x: 520, y: 240, width: 200, height: 200 },
    { name: "control-4-building", x: 780, y: 708, width: 200, height: 200 },
    { name: "control-6-lake", x: 1120, y: 832, width: 220, height: 220 },
    { name: "colours-busy", x: 880, y: 720, width: 320, height: 240 },
    { name: "scale-bar", x: WIDTH - 340, y: HEIGHT - 90, width: 320, height: 80 },
  ];
  if (lastCoursePlan) {
    for (const c of lastCoursePlan.controls.slice(0, 3)) {
      const [cx, cy] = c.position;
      crops.push({
        name: `control-${c.number}-${c.featureType}`,
        x: Math.max(0, Math.round(cx - 100)),
        y: Math.max(0, Math.round(cy - 100)),
        width: 200,
        height: 200,
      });
    }
  }
  for (const c of crops) {
    await page.screenshot({
      path: join(outDir, `${c.name}.png`),
      clip: c,
    });
  }
  console.log(`Verification crops → ${outDir}`);
}

async function rasterize(svg) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
    });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;overflow:hidden;background:#fff"><div id="root">${svg}</div></body></html>`;
    await page.setContent(html, { waitUntil: "load" });
    await page.locator("svg").screenshot({
      path: join(OUT_DIR, "sample-map.png"),
      type: "png",
    });
    if (process.env.VERIFY_MAP_SHOTS === "1") {
      await captureVerificationCrops(page);
    }
  } finally {
    await browser.close();
  }
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function main() {
  const svg = buildSvg();
  const svgPath = join(OUT_DIR, "sample-map.svg");
  writeFileSync(svgPath, svg, "utf8");
  if (lastCoursePlan && lastLakePts) {
    const jsonPath = join(OUT_DIR, "sample-course.json");
    writeFileSync(jsonPath, exportSampleCourseJson(lastCoursePlan, lastLakePts), "utf8");
    console.log(`Wrote ${jsonPath}`);
    console.log("ISCD control descriptions:");
    console.log(`  Start: ${lastCoursePlan.start.featureD} @ ${lastCoursePlan.start.position.join(",")}`);
    for (const c of lastCoursePlan.controls) {
      const loc = c.locationG ? ` (${c.locationG})` : "";
      console.log(`  ${c.number}: ${c.featureD}${loc} [${c.code}] @ ${c.position.join(",")}`);
    }
    console.log(`  Finish: ${lastCoursePlan.finish.featureD} @ ${lastCoursePlan.finish.position.join(",")}`);
  }
  await rasterize(svg);
  const pngPath = join(OUT_DIR, "sample-map.png");
  const hash = sha256File(pngPath);
  console.log(`Wrote ${svgPath} and sample-map.png (${WIDTH}x${HEIGHT})`);
  console.log(`SHA256 sample-map.png: ${hash}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
