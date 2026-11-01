import { MAP } from "./capture-utils";

/** Ordered polyline: control center → … → next control center (2–6 vertices). */
export type RouteWaypoints = readonly (readonly [number, number])[];

const S = MAP.start;
const C = MAP.controls;
const F = MAP.finish;

/** Start → 1 via track A (reverse) then open north. */
export const LEG_START_1: RouteWaypoints = [
  S,
  [450, 560],
  [520, 530],
  [580, 580],
  [610, 420],
  C[0],
];

/** 1 → 2 through open north of road junction. */
export const LEG_1_2: RouteWaypoints = [C[0], [720, 380], [780, 470], C[1]];

/** 2 → 3 along main road (road D + track C). */
export const LEG_2_3: RouteWaypoints = [
  C[1],
  [980, 720],
  [1060, 815],
  [1300, 798],
  [1580, 760],
  [1700, 580],
  [1770, 480],
  C[2],
];

/** 3 → 4 cut south-east through open. */
export const LEG_3_4: RouteWaypoints = [C[2], [1680, 520], [1580, 620], C[3]];

/** 4 → 5 west of lake (south shore). */
export const LEG_4_5: RouteWaypoints = [
  C[3],
  [1380, 720],
  [1240, 920],
  [1120, 1020],
  C[4],
];

/** 5 → 6 via stream valley west of lake. */
export const LEG_5_6: RouteWaypoints = [C[4], [1180, 920], [980, 980], [780, 1020], C[5]];

/** 6 → 7 along road spur. */
export const LEG_6_7: RouteWaypoints = [C[5], [680, 920], [720, 850], C[6]];

/** 7 → Finish — west/south around lake. */
export const LEG_7_FINISH_WEST: RouteWaypoints = [
  C[6],
  [800, 920],
  [900, 1050],
  [1020, 1220],
  [1280, 1340],
  [1620, 1370],
  F,
];

/** 7 → Finish — east/north around lake. */
export const LEG_7_FINISH_EAST: RouteWaypoints = [
  C[6],
  [900, 700],
  [1180, 670],
  [1500, 740],
  [1760, 920],
  [1870, 1150],
  F,
];

export const HERO_LEGS: RouteWaypoints[] = [LEG_START_1, LEG_1_2, LEG_2_3, LEG_3_4];

export const OPACITY_LEGS: RouteWaypoints[] = [LEG_4_5, LEG_5_6, LEG_6_7];

/** Centroid of start + controls 1–4 for hero framing. */
export function heroFramingCenter(): { x: number; y: number } {
  const pts = [S, C[0], C[1], C[2], C[3]] as const;
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return { x, y };
}

/** Start + controls 1–3 only (hero fallback center). */
export function heroFramingCenterFallback(): { x: number; y: number } {
  const pts = [S, C[0], C[1], C[2]] as const;
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return { x, y };
}
