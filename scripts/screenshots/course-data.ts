import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
export const SAMPLE_COURSE_JSON_PATH = path.join(scriptsDir, "sample-course.json");

export type MapPoint = readonly [number, number];

export type SampleCourse = {
  start: { position: MapPoint };
  finish: { position: MapPoint };
  controls: {
    number: number;
    position: MapPoint;
  }[];
  geometry: {
    lakeOutline: MapPoint[];
    road: MapPoint[];
    tracks: { trackA: MapPoint[]; trackB: MapPoint[]; trackC: MapPoint[] };
    paths: { smallPathA: MapPoint[]; smallPathB: MapPoint[]; pathToBuildings: MapPoint[] };
    stream: { inflow: MapPoint[]; inflowToLake: MapPoint[]; outflow: MapPoint[] };
  };
};

export const MAP_WIDTH = 2400;
export const MAP_HEIGHT = 1700;

let cachedCourse: SampleCourse | null = null;

export function loadSampleCourse(): SampleCourse {
  if (cachedCourse !== null) return cachedCourse;
  const raw = JSON.parse(readFileSync(SAMPLE_COURSE_JSON_PATH, "utf8")) as SampleCourse;
  cachedCourse = raw;
  return raw;
}

export function controlPosition(course: SampleCourse, number: number): MapPoint {
  const c = course.controls.find((x) => x.number === number);
  if (c === undefined) throw new Error(`control ${number} not found in sample-course.json`);
  return c.position;
}

export function mapFromCourse(course: SampleCourse = loadSampleCourse()) {
  const controls = [...course.controls].sort((a, b) => a.number - b.number).map((c) => c.position);
  const lake = course.geometry.lakeOutline;
  const lakeCenter: MapPoint = [
    lake.reduce((s, p) => s + p[0], 0) / lake.length,
    lake.reduce((s, p) => s + p[1], 0) / lake.length,
  ];
  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    start: course.start.position,
    controls,
    finish: course.finish.position,
    lakeOutline: lake,
    lakeCenter,
  };
}

export function pointInPolygon(x: number, y: number, polygon: readonly MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInLake(x: number, y: number, course: SampleCourse = loadSampleCourse()): boolean {
  return pointInPolygon(x, y, course.geometry.lakeOutline);
}

export function distMapPoints(a: MapPoint, b: MapPoint): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function assertLegEndpoints(
  waypoints: readonly MapPoint[],
  from: MapPoint,
  to: MapPoint,
  label: string,
): void {
  if (distMapPoints(waypoints[0], from) > 1.5) {
    throw new Error(`${label}: route must start at leg origin (${from})`);
  }
  const last = waypoints[waypoints.length - 1];
  if (distMapPoints(last, to) > 1.5) {
    throw new Error(`${label}: route must end at leg destination (${to})`);
  }
}

export function assertNoBacktracking(waypoints: readonly MapPoint[], label: string): void {
  const [sx, sy] = waypoints[0];
  const [ex, ey] = waypoints[waypoints.length - 1];
  const len2 = (ex - sx) ** 2 + (ey - sy) ** 2 || 1;
  let lastT = -0.05;
  for (const [px, py] of waypoints) {
    const t = ((px - sx) * (ex - sx) + (py - sy) * (ey - sy)) / len2;
    if (t + 0.03 < lastT) {
      throw new Error(`${label}: route backtracks along leg bearing`);
    }
    lastT = Math.max(lastT, t);
  }
}

export function assertPathAvoidsLake(
  path: readonly MapPoint[],
  label: string,
  course: SampleCourse = loadSampleCourse(),
): void {
  for (const [x, y] of path) {
    if (pointInLake(x, y, course)) {
      throw new Error(`${label}: route enters lake at (${x.toFixed(1)}, ${y.toFixed(1)})`);
    }
  }
}
