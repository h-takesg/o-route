/**
 * Deterministic fictional ISOM-style sample map (SVG → PNG via Playwright).
 * Terrain is authored with explicit geometry; noise perturbs edges only.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = __dirname;
const WIDTH = 2400;
const HEIGHT = 1700;
/** Fixed seed — byte-identical output on every run. */
const MAP_SEED = 0x4f524f55;

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
  const cx = (apex[0] + bl[0] + br[0]) / 3;
  const cy = (apex[1] + bl[1] + br[1]) / 3;
  const edges = [
    [apex, bl],
    [bl, br],
    [br, apex],
  ];
  let best = null;
  let bestT = Infinity;
  for (const [e0, e1] of edges) {
    const hit = segmentIntersect([cx, cy], target, e0, e1);
    if (!hit) continue;
    const t = Math.hypot(hit[0] - cx, hit[1] - cy);
    if (t < bestT) {
      bestT = t;
      best = hit;
    }
  }
  return best || apex;
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

function validateCourseGeometry(controls, legSegments, controlR, labelPositions) {
  const clearance = controlR + 15;
  for (let li = 0; li < legSegments.length; li++) {
    const leg = legSegments[li];
    const skip = new Set();
    if (li === 0) skip.add(0);
    else if (li === legSegments.length - 1) skip.add(controls.length - 1);
    else {
      skip.add(li - 1);
      skip.add(li);
    }
    for (let ci = 0; ci < controls.length; ci++) {
      if (skip.has(ci)) continue;
      const d = distSegmentToPoint(leg.p0, leg.p1, controls[ci]);
      if (d < clearance) {
        throw new Error(
          `Course leg ${li + 1} passes within ${clearance}px of control ${ci + 1} (d=${d.toFixed(1)})`,
        );
      }
    }
  }
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

function buildSvg() {
  const basinCx = 1150;
  const basinCy = 1140;
  const hGrid = smoothGrid(
    sampleGrid(authoredHeight, HEIGHT_GRID_W, HEIGHT_GRID_H),
    HEIGHT_GRID_W,
    HEIGHT_GRID_H,
    3,
  );
  const { lakePts } = lakeFromBasin(hGrid, HEIGHT_GRID_W, HEIGHT_GRID_H, basinCx, basinCy);

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
  parts.push(`<rect width="${WIDTH}" height="${HEIGHT}" fill="#FFFFFF"/>`);
  parts.push(landClipPathDef(lakePts));
  parts.push(`<g clip-path="url(#landClip)">`);

  const openPatches = [
    { cx: 760, cy: 860, rx: 165, ry: 95, rot: -0.12, rough: true },
    { cx: 760, cy: 860, rx: 130, ry: 72, rot: -0.12, rough: false },
    { cx: 1760, cy: 430, rx: 120, ry: 85, rot: 0.35, rough: false },
    { cx: 520, cy: 540, rx: 95, ry: 70, rot: 0.1, rough: false },
  ];

  const vegPatches = [
    { cx: 1260, cy: 740, rx: 280, ry: 58, rot: 0.52, color: "#C5FFB9", a2: 0.1, phi2: 0.2 },
    { cx: 1310, cy: 810, rx: 210, ry: 48, rot: 0.48, color: "#C5FFB9" },
    { cx: 1180, cy: 880, rx: 150, ry: 44, rot: 0.45, color: "#C5FFB9" },
    { cx: 1000, cy: 1010, rx: 130, ry: 72, rot: 0.2, color: "#C5FFB9" },
    {
      cx: 540,
      cy: 710,
      rx: 118,
      ry: 78,
      rot: -0.35,
      color: "#C5FFB9",
      core: "#8BFF74",
      coreScale: 0.58,
    },
    { cx: 1860, cy: 870, rx: 105, ry: 68, rot: 0.25, color: "#8BFF74" },
    { cx: 1460, cy: 510, rx: 92, ry: 62, rot: 0.12, color: "#C5FFB9" },
    {
      cx: 900,
      cy: 470,
      rx: 82,
      ry: 52,
      rot: 0.55,
      color: "#C5FFB9",
      core: "#3DFF17",
      coreScale: 0.48,
    },
    { cx: 1220, cy: 1260, rx: 105, ry: 58, rot: -0.15, color: "#C5FFB9" },
    { cx: 660, cy: 960, rx: 98, ry: 52, rot: 0.55, color: "#8BFF74" },
  ];

  for (const p of openPatches.filter((o) => o.rough)) {
    const poly = irregularPatch(p.cx, p.cy, p.rx + 20, p.ry + 14, p.rot, 501, { a2: 0.16, a3: 0.1 });
    if (!pointInPolygon(p.cx, p.cy, lakePts)) {
      parts.push(`<path d="${polylinePath(poly, true)}" fill="#FFDD9A" stroke="none"/>`);
    }
  }
  for (const p of openPatches.filter((o) => !o.rough)) {
    const poly = irregularPatch(p.cx, p.cy, p.rx, p.ry, p.rot, 502, {
      a2: 0.12,
      a3: 0.07,
      phi2: p.rot,
    });
    if (!pointInPolygon(p.cx, p.cy, lakePts)) {
      parts.push(`<path d="${polylinePath(poly, true)}" fill="#FFBA36" stroke="none"/>`);
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
    `<polygon points="${polygonPoints(lakePts)}" fill="#00A0E1" fill-opacity="0.6" stroke="none"/>`,
  );

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
    const strokeW = isIndex ? 3.5 : 2;
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
        `<path d="${polylinePath(poly, closed)}" fill="none" stroke="#D15C00" stroke-width="${strokeW}" stroke-linejoin="round" stroke-linecap="round"/>`,
      );
    }
  }

  for (let x = 125; x < WIDTH; x += 250) {
    parts.push(
      `<line x1="${x}" y1="0" x2="${x}" y2="${HEIGHT}" stroke="#00A0E1" stroke-width="1.5" opacity="0.65"/>`,
    );
  }

  parts.push(
    `<polygon points="${polygonPoints(lakePts)}" fill="none" stroke="#00A0E1" stroke-width="2.5"/>`,
  );

  const inflowShore = northLakeShorePoint(lakePts);
  const inflowWps = [
    [1160, 140],
    [1225, 280],
    [1155, 430],
    [1105, 580],
    [1135, 720],
    [1095, 860],
    [1100, 960],
    [1105, 1040],
  ].filter(([, y]) => y < inflowShore[1] - 60);
  inflowWps.push([inflowShore[0], inflowShore[1] - 35], [inflowShore[0], inflowShore[1]]);
  const inflowBody = inflowWps.slice(0, -1);
  const inflowD = `${catmullRomPath(inflowBody)} L${inflowShore[0].toFixed(1)},${inflowShore[1].toFixed(1)}`;
  parts.push(
    `<path d="${inflowD}" fill="none" stroke="#00A0E1" stroke-width="2.5" stroke-linecap="round"/>`,
  );

  const outflowShore = lakeShorePoint(lakePts, basinCy + 130, basinCx);
  const outflowWps = [
    [outflowShore[0], outflowShore[1]],
    [1135, 1410],
    [1115, 1550],
    [1095, 1675],
  ];
  parts.push(
    `<path d="${catmullRomPath(outflowWps)}" fill="none" stroke="#00A0E1" stroke-width="2.5" stroke-linecap="round"/>`,
  );

  let marshY = inflowShore[1] - 32;
  const marshCx = inflowShore[0] - 38;
  while (marshY > 40 && pointInPolygon(marshCx, marshY, lakePts)) {
    marshY -= 10;
  }
  for (let mx = marshCx - 55; mx < marshCx + 45; mx += 22) {
    if (pointInPolygon(mx, marshY, lakePts)) continue;
    parts.push(
      `<line x1="${mx.toFixed(0)}" y1="${marshY.toFixed(0)}" x2="${(mx + 14).toFixed(0)}" y2="${marshY.toFixed(0)}" stroke="#00A0E1" stroke-width="2.2" stroke-linecap="round"/>`,
    );
  }

  const roadPts = [
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
  const roadD = catmullRomPath(roadPts);
  parts.push(
    `<path d="${roadD}" fill="none" stroke="#FFBA36" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>`,
  );
  parts.push(
    `<path d="${catmullRomPath(offsetPolyline(roadPts, 5.5))}" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round"/>`,
  );
  parts.push(
    `<path d="${catmullRomPath(offsetPolyline(roadPts, -5.5))}" fill="none" stroke="#000000" stroke-width="2.2" stroke-linecap="round"/>`,
  );

  const trackA = [
    [820, 835],
    [700, 720],
    [580, 620],
    [480, 520],
  ];
  const trackB = [
    [1300, 798],
    [1420, 720],
    [1540, 660],
    [1660, 620],
  ];
  const trackC = [
    [1060, 815],
    [980, 720],
    [900, 640],
  ];
  for (const t of [trackA, trackB, trackC]) {
    if (pathClearOfLake(t, lakePts)) {
      parts.push(
        `<path d="${catmullRomPath(t)}" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round"/>`,
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
    `<path d="${catmullRomPath(lakeShorePath)}" fill="none" stroke="#000000" stroke-width="2.5" stroke-dasharray="10 9" stroke-linecap="round"/>`,
  );

  const smallPathA = [
    [360, 890],
    [300, 960],
    [260, 1040],
  ];
  const smallPathB = [
    [1660, 620],
    [1740, 680],
    [1800, 760],
  ];
  for (const p of [smallPathA, smallPathB]) {
    if (pathClearOfLake(p, lakePts)) {
      parts.push(
        `<path d="${catmullRomPath(p)}" fill="none" stroke="#000000" stroke-width="2.5" stroke-dasharray="8 8" stroke-linecap="round"/>`,
      );
    }
  }

  const pathToBuildings = [
    [1780, 775],
    [1840, 820],
    [1880, 860],
  ];
  if (pathClearOfLake(pathToBuildings, lakePts)) {
    parts.push(
      `<path d="${catmullRomPath(pathToBuildings)}" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round"/>`,
    );
  }

  const buildings = [
    [1868, 848, 34, 28],
    [1920, 868, 28, 24],
    [848, 808, 32, 26],
  ];
  for (const [bx, by, bw, bh] of buildings) {
    parts.push(`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="#000000"/>`);
  }

  const boulders = [
    [680, 340],
    [710, 365],
    [560, 450],
    [1750, 560],
    [1780, 590],
    [1690, 1280],
    [1720, 1310],
    [820, 640],
  ];
  for (const [bx, by] of boulders) {
    parts.push(`<circle cx="${bx}" cy="${by}" r="3" fill="#000000"/>`);
  }

  const knolls = [
    [620, 340],
    [1820, 440],
    [1720, 1320],
  ];
  for (const [kx, ky] of knolls) {
    parts.push(`<circle cx="${kx}" cy="${ky}" r="4" fill="#D15C00"/>`);
  }

  const cliffPts = [
    [520, 460],
    [560, 520],
    [600, 580],
    [640, 640],
  ];
  parts.push(
    `<path d="${catmullRomPath(cliffPts)}" fill="none" stroke="#000000" stroke-width="2.8" stroke-linecap="round"/>`,
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
      `<line x1="${(p[0] + tx).toFixed(1)}" y1="${(p[1] + ty).toFixed(1)}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="#000000" stroke-width="2"/>`,
    );
  }

  const cliffPts2 = [
    [1760, 520],
    [1720, 580],
    [1680, 640],
  ];
  parts.push(
    `<path d="${catmullRomPath(cliffPts2)}" fill="none" stroke="#000000" stroke-width="2.8" stroke-linecap="round"/>`,
  );
  for (const p of cliffPts2) {
    parts.push(
      `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${(p[0] + 10).toFixed(1)}" y2="${(p[1] + 12).toFixed(1)}" stroke="#000000" stroke-width="2"/>`,
    );
  }

  const overprint = "#CD3FA0";
  const controlR = 38;
  const legStroke = 4;
  const finishOuterR = controlR + 10;

  const start = [380, 580];
  const triSize = 34;
  const triApex = [start[0], start[1] - triSize];
  const triBl = [start[0] - triSize * 0.866, start[1] + triSize / 2];
  const triBr = [start[0] + triSize * 0.866, start[1] + triSize / 2];

  const controls = [
    [620, 310],
    [830, 560],
    [1790, 390],
    [1500, 660],
    [1340, 780],
    [620, 1040],
    [740, 800],
  ];
  const finish = [1900, 1380];
  const course = [start, ...controls, finish];

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
  validateCourseGeometry(controls, legSegments, controlR, labelPositions);

  for (const leg of legSegments) {
    parts.push(
      `<path d="M${leg.p0[0].toFixed(1)},${leg.p0[1].toFixed(1)} L${leg.p1[0].toFixed(1)},${leg.p1[1].toFixed(1)}" fill="none" stroke="${overprint}" stroke-width="${legStroke}" stroke-linecap="round"/>`,
    );
  }

  parts.push(
    `<polygon points="${triApex[0]},${triApex[1]} ${triBl[0]},${triBl[1]} ${triBr[0]},${triBr[1]}" fill="none" stroke="${overprint}" stroke-width="${legStroke}" stroke-linejoin="round"/>`,
  );

  controls.forEach((c, idx) => {
    const num = idx + 1;
    const { x: tx, y: ty } = labelPositions[idx];
    parts.push(
      `<circle cx="${c[0]}" cy="${c[1]}" r="${controlR}" fill="none" stroke="${overprint}" stroke-width="${legStroke}"/>`,
    );
    parts.push(
      `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="bold" fill="${overprint}">${num}</text>`,
    );
  });

  parts.push(
    `<circle cx="${finish[0]}" cy="${finish[1]}" r="${finishOuterR}" fill="none" stroke="${overprint}" stroke-width="${legStroke}"/>`,
    `<circle cx="${finish[0]}" cy="${finish[1]}" r="${controlR - 4}" fill="none" stroke="${overprint}" stroke-width="${legStroke}"/>`,
  );

  const label = "O-Route サンプル地図（架空）";
  const labelX = 40;
  const labelY = HEIGHT - 44;
  parts.push(
    `<rect x="${labelX}" y="${labelY - 48}" width="480" height="56" fill="#FFFFFF" stroke="#CCCCCC" stroke-width="1"/>`,
    `<text x="${labelX + 14}" y="${labelY}" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#000000">${escapeXml(label)}</text>`,
  );

  const scaleX = WIDTH - 320;
  const scaleY = HEIGHT - 48;
  const scaleLen = 200;
  parts.push(
    `<rect x="${scaleX - 10}" y="${scaleY - 36}" width="${scaleLen + 80}" height="40" fill="#FFFFFF"/>`,
    `<line x1="${scaleX}" y1="${scaleY}" x2="${scaleX + scaleLen}" y2="${scaleY}" stroke="#000000" stroke-width="3"/>`,
    `<line x1="${scaleX}" y1="${scaleY - 8}" x2="${scaleX}" y2="${scaleY + 8}" stroke="#000000" stroke-width="2"/>`,
    `<line x1="${scaleX + scaleLen}" y1="${scaleY - 8}" x2="${scaleX + scaleLen}" y2="${scaleY + 8}" stroke="#000000" stroke-width="2"/>`,
    `<text x="${scaleX + scaleLen / 2 - 36}" y="${scaleY - 14}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#000000">100 m</text>`,
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
${parts.join("\n")}
</svg>`;
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
  } finally {
    await browser.close();
  }
}

async function main() {
  const svg = buildSvg();
  const svgPath = join(OUT_DIR, "sample-map.svg");
  writeFileSync(svgPath, svg, "utf8");
  await rasterize(svg);
  console.log(`Wrote ${svgPath} and sample-map.png (${WIDTH}x${HEIGHT})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
