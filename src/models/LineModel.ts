import { List, Map, Record } from "immutable";
import { Point, intersectsLineSegment } from "../math";

const DrawLineBase = Record({
  isDrawing: false,
  points: List<number>(),
  timestamp: Date.now(),
  compositionMode: "source-over" as GlobalCompositeOperation,
});

class DrawLine extends DrawLineBase {
  static of(object: DrawLine) {
    return new DrawLine({
      ...object,
      points: List<number>(object.points),
    });
  }

  addPoint(point: Point) {
    const newPoints = this.points.push(point.x).push(point.y);
    return this.set("points", newPoints);
  }

  addValue(value: number) {
    const newPoints = this.points.push(value);
    return this.set("points", newPoints);
  }

  endDrawing() {
    return this.set("isDrawing", false);
  }

  isCrossing(p0: Point, p1: Point) {
    for (let i = 0; i < this.points.size / 2 - 1; i++) {
      const lp0 = this.getPoint(i);
      const lp1 = this.getPoint(i + 1);
      if (typeof lp0 === "undefined" || typeof lp1 === "undefined") continue;

      if (intersectsLineSegment([p0, p1], [lp0, lp1])) return true;
    }
    return false;
  }

  private getPoint(index: number): Point | undefined {
    const v0 = this.points.get(index * 2);
    const v1 = this.points.get(index * 2 + 1);
    if (typeof v0 === "undefined" || typeof v1 === "undefined")
      return undefined;
    return { x: v0, y: v1 };
  }
}

const LinesBase = Record({
  lines: Map<string, DrawLine>(),
});

class Lines extends LinesBase {
  addLine(line: DrawLine): [newLines: this, key: string] {
    const key = this.getNewKey();
    const newLines = this.setIn(["lines", key], line);
    return [newLines, key];
  }

  addLineWithKey(key: string, line: DrawLine) {
    return this.setIn(["lines", key], line);
  }

  addPoint(key: string, point: Point) {
    const newLine = this.lines.get(key)?.addPoint(point);
    return this.setIn(["lines", key], newLine);
  }

  addValue(key: string, value: number) {
    const newLine = this.lines.get(key)?.addValue(value);
    return this.setIn(["lines", key], newLine);
  }

  endDrawing(key: string) {
    const newLine = this.lines.get(key)?.endDrawing();
    return this.setIn(["lines", key], newLine);
  }

  updateTimestamp(key: string, newTimestamp: number) {
    return this.setIn(["lines", key, "timestamp"], newTimestamp);
  }

  getLength(key: string) {
    return this.lines.get(key)?.get("points").size;
  }

  getCrossingLine(p0: Point, p1: Point): string[] {
    return this.lines
      .filter((line) => line.isCrossing(p0, p1))
      .keySeq()
      .toArray();
  }

  removeLine(...targets: string[]) {
    const newLines = this.lines.filter((line, key) => !targets.includes(key));
    return this.set("lines", newLines);
  }

  private getNewKey() {
    if (this.lines.size === 0) return "0";
    else {
      const ids = this.lines.keySeq().map((e) => Number(e));
      return (Math.max(...ids) + 1).toString();
    }
  }
}

export { DrawLine, Lines };
