export type Point = [number, number];
export type LineSegment = [Point, Point];
// https://github.com/nobuhikosawai/drawing-tool-utils/blob/41405309a4e16286a53162e7c9b407359879b136/src/line-segment.ts#L11-L32
export const intersectsLineSegment = (
  l1: LineSegment,
  l2: LineSegment
): boolean => {
  const [p1, p2] = l1,
    [p3, p4] = l2;
  const [x1, y1] = p1,
    [x2, y2] = p2,
    [x3, y3] = p3,
    [x4, y4] = p4;

  const D = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (D === 0) {
    return false;
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / D;
  const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / D;

  // intersection is [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};
