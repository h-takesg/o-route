export type VectorValue = { x: number; y: number };
export type Point = VectorValue;
export type LineSegment = [Point, Point];

export const intersectsLineSegment = (l1: LineSegment, l2: LineSegment): boolean => {
  const [p1, p2] = l1,
    [p3, p4] = l2;
  const { x: x1, y: y1 } = p1,
    { x: x2, y: y2 } = p2,
    { x: x3, y: y3 } = p3,
    { x: x4, y: y4 } = p4;

  const D = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (D === 0) {
    const onSegment = (p: Point, a: Point, b: Point) => {
      return (
        Math.min(a.x, b.x) <= p.x &&
        p.x <= Math.max(a.x, b.x) &&
        Math.min(a.y, b.y) <= p.y &&
        p.y <= Math.max(a.y, b.y)
      );
    };

    return (
      onSegment(p1, p3, p4) ||
      onSegment(p2, p3, p4) ||
      onSegment(p3, p1, p2) ||
      onSegment(p4, p1, p2)
    );
  }

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / D;
  const u = ((x1 - x3) * (y1 - y2) - (y1 - y3) * (x1 - x2)) / D;

  // intersection is [x1 + t * (x2 - x1), y1 + t * (y2 - y1)]
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};

export const clamp = (min: number, x: number, max: number) => Math.max(min, Math.min(x, max));
export const closestToZero = (...data: number[]) =>
  data.sort((a, b) => Math.abs(a) - Math.abs(b))[0];

export const degreeToRadian = (degree: number) => (degree * Math.PI) / 180;
export const radianToDegree = (radian: number) => (radian * 180) / Math.PI;

export class Vector {
  readonly x: number;
  readonly y: number;

  constructor({ x, y }: VectorValue = { x: 0, y: 0 }) {
    this.x = x;
    this.y = y;
  }

  getAdd(vec: VectorValue): Vector {
    return new Vector({
      x: this.x + vec.x,
      y: this.y + vec.y,
    });
  }

  getSub(vec: VectorValue) {
    return new Vector({
      x: this.x - vec.x,
      y: this.y - vec.y,
    });
  }

  getRotated(degree: number) {
    const radian = degreeToRadian(degree);
    return new Vector({
      x: this.x * Math.cos(radian) - this.y * Math.sin(radian),
      y: this.x * Math.sin(radian) + this.y * Math.cos(radian),
    });
  }

  getScaled(scale: number) {
    return new Vector({
      x: this.x * scale,
      y: this.y * scale,
    });
  }

  getReverse() {
    return new Vector({
      x: -this.x,
      y: -this.y,
    });
  }

  getSize() {
    return Math.sqrt(this.x ** 2 + this.y ** 2);
  }

  // -pi/2
  getRotationDegree() {
    return radianToDegree(Math.atan2(this.y, this.x));
  }
}
