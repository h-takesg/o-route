import { describe, expect, it } from "vitest";
import {
  Vector,
  clamp,
  closestToZero,
  degreeToRadian,
  intersectsLineSegment,
  radianToDegree,
} from "./math";

describe("intersectsLineSegment", () => {
  it("returns true when segments cross in the middle", () => {
    expect(
      intersectsLineSegment(
        [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ],
        [
          { x: 0, y: 10 },
          { x: 10, y: 0 },
        ],
      ),
    ).toBe(true);
  });

  it("returns false for parallel segments", () => {
    expect(
      intersectsLineSegment(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        [
          { x: 0, y: 5 },
          { x: 10, y: 5 },
        ],
      ),
    ).toBe(false);
  });

  it("returns false when segments do not meet within bounds", () => {
    expect(
      intersectsLineSegment(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        [
          { x: 5, y: 0 },
          { x: 6, y: 0 },
        ],
      ),
    ).toBe(false);
  });

  it("returns true when segments share an endpoint", () => {
    expect(
      intersectsLineSegment(
        [
          { x: 0, y: 0 },
          { x: 5, y: 5 },
        ],
        [
          { x: 5, y: 5 },
          { x: 10, y: 0 },
        ],
      ),
    ).toBe(true);
  });
});

describe("clamp", () => {
  it("clamps below minimum", () => {
    expect(clamp(0, -1, 10)).toBe(0);
  });

  it("clamps above maximum", () => {
    expect(clamp(0, 11, 10)).toBe(10);
  });

  it("returns value when within range", () => {
    expect(clamp(0, 5, 10)).toBe(5);
  });
});

describe("closestToZero", () => {
  it("picks the value nearest to zero", () => {
    expect(closestToZero(5, -2, 3)).toBe(-2);
    expect(closestToZero(10, -9, 8)).toBe(8);
  });
});

describe("degreeToRadian / radianToDegree", () => {
  it("converts degrees and radians consistently", () => {
    expect(degreeToRadian(180)).toBeCloseTo(Math.PI);
    expect(radianToDegree(Math.PI)).toBeCloseTo(180);
  });
});

describe("Vector", () => {
  it("defaults to origin", () => {
    const v = new Vector();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it("adds and subtracts vectors", () => {
    const v = new Vector({ x: 3, y: 4 });
    expect(v.getAdd({ x: 1, y: 2 })).toEqual(new Vector({ x: 4, y: 6 }));
    expect(v.getSub({ x: 1, y: 2 })).toEqual(new Vector({ x: 2, y: 2 }));
  });

  it("scales and reverses", () => {
    const v = new Vector({ x: 2, y: -3 });
    expect(v.getScaled(2)).toEqual(new Vector({ x: 4, y: -6 }));
    expect(v.getReverse()).toEqual(new Vector({ x: -2, y: 3 }));
  });

  it("computes size", () => {
    expect(new Vector({ x: 3, y: 4 }).getSize()).toBe(5);
  });

  it("rotates 90 degrees", () => {
    const rotated = new Vector({ x: 1, y: 0 }).getRotated(90);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(1);
  });

  it("reports rotation degree", () => {
    expect(new Vector({ x: 0, y: 1 }).getRotationDegree()).toBeCloseTo(90);
    expect(new Vector({ x: 1, y: 0 }).getRotationDegree()).toBeCloseTo(0);
  });
});
