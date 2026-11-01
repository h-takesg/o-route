import { buildDrawPathFromWaypoints, type RouteLegMeta } from "./capture-utils";
import {
  controlPosition,
  loadSampleCourse,
  type MapPoint,
} from "./course-data";

/** Ordered polyline: control center → … → next control center (2–6 vertices). */
export type RouteWaypoints = readonly MapPoint[];

const course = loadSampleCourse();
const S = course.start.position;
const F = course.finish.position;
const C = (n: number) => controlPosition(course, n);

const road = course.geometry.road;
const trackA = course.geometry.tracks.trackA;
const trackC = course.geometry.tracks.trackC;
const smallPathA = course.geometry.paths.smallPathA;
const streamIn = course.geometry.stream.inflow;

function defineLeg(
  label: string,
  from: MapPoint,
  to: MapPoint,
  mid: MapPoint[],
): { waypoints: RouteWaypoints; meta: RouteLegMeta } {
  const waypoints: RouteWaypoints = [from, ...mid, to];
  const meta: RouteLegMeta = { label, from, to };
  buildDrawPathFromWaypoints(waypoints, meta);
  return { waypoints, meta };
}

/** Start → 1 via road + track A spur. */
export const LEG_START_1 = defineLeg("Start→1", S, C(1), [
  road[2],
  road[3],
  trackA[1],
  trackA[2],
  [600, 480],
]);

/** 1 → 2 through open slope east of knoll. */
export const LEG_1_2 = defineLeg("1→2", C(1), C(2), [
  [720, 400],
  [780, 520],
  [810, 600],
]);

/** 2 → 3 via track C toward building. */
export const LEG_2_3 = defineLeg("2→3", C(2), C(3), [[860, 680], [880, 740]]);

/** 3 → 4 along stream approach. */
export const LEG_3_4 = defineLeg("3→4", C(3), C(4), [streamIn[4], streamIn[5]]);

/** 4 → 5 north through vegetation boundary. */
export const LEG_4_5 = defineLeg("4→5", C(4), C(5), [
  [1060, 760],
  [1020, 640],
  [980, 560],
]);

/** 5 → 6 east via road + track B. */
export const LEG_5_6 = defineLeg("5→6", C(5), C(6), [
  [1180, 510],
  [1480, 480],
  [1680, 455],
]);

/** 6 → 7 south-east around lake (east side). */
export const LEG_6_7 = defineLeg("6→7", C(6), C(7), [
  course.geometry.paths.pathToBuildings[0],
  [1860, 980],
  [1780, 1220],
]);

/** 7 → Finish north of lake (road + path to finish). */
export const LEG_7_FINISH_NORTH = defineLeg("7→Finish (north)", C(7), F, [
  [1710, 1180],
  [1650, 900],
  [1480, 780],
  [1180, 790],
  [780, 840],
  road[1],
  smallPathA[1],
]);

/** 7 → Finish south of lake (wide arc below water). */
export const LEG_7_FINISH_SOUTH = defineLeg("7→Finish (south)", C(7), F, [
  [1620, 1360],
  [1280, 1330],
  [960, 1290],
  [620, 1180],
  [340, 1080],
]);

export const HERO_LEGS = [LEG_START_1, LEG_1_2, LEG_2_3, LEG_3_4] as const;

export const OPACITY_LEGS = [LEG_4_5, LEG_5_6, LEG_6_7] as const;

/** One leg for view-sharing demo (3 → 4). */
export const SHARING_LEG = LEG_3_4;

export function heroFramingCenter(): { x: number; y: number } {
  const pts = [S, C(1), C(2), C(3), C(4)];
  return {
    x: pts.reduce((s, p) => s + p[0], 0) / pts.length,
    y: pts.reduce((s, p) => s + p[1], 0) / pts.length,
  };
}

export function heroFramingCenterFallback(): { x: number; y: number } {
  const pts = [S, C(1), C(2), C(3)];
  return {
    x: pts.reduce((s, p) => s + p[0], 0) / pts.length,
    y: pts.reduce((s, p) => s + p[1], 0) / pts.length,
  };
}

export function lakeFramingPoints(): MapPoint[] {
  return [C(7), F, [1200, 1150], [900, 1150]];
}
