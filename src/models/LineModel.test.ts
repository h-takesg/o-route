import { List } from "immutable";
import { describe, expect, it } from "vitest";
import { DrawLine, Lines } from "./LineModel";

describe("DrawLine", () => {
  it("addPoint appends x and y coordinates", () => {
    const line = new DrawLine().addPoint({ x: 1, y: 2 }).addPoint({ x: 3, y: 4 });

    expect(line.points.toArray()).toEqual([1, 2, 3, 4]);
  });

  it("addValue appends a single coordinate value", () => {
    const line = new DrawLine().addValue(5);

    expect(line.points.toArray()).toEqual([5]);
  });

  it("endDrawing marks the line as finished", () => {
    const line = new DrawLine({ isDrawing: true }).endDrawing();

    expect(line.isDrawing).toBe(false);
  });

  it("isCrossing detects intersection with an eraser segment", () => {
    const line = new DrawLine()
      .addPoint({ x: 0, y: 0 })
      .addPoint({ x: 10, y: 10 });

    expect(line.isCrossing({ x: 0, y: 10 }, { x: 10, y: 0 })).toBe(true);
    expect(line.isCrossing({ x: 20, y: 20 }, { x: 30, y: 30 })).toBe(false);
  });

  it("of rebuilds a line from a plain object", () => {
    const line = DrawLine.of({
      isDrawing: false,
      points: List([0, 0, 5, 5]),
      timestamp: 123,
      compositionMode: "source-over",
    });

    expect(line.points.toArray()).toEqual([0, 0, 5, 5]);
    expect(line.timestamp).toBe(123);
  });
});

describe("Lines", () => {
  it("addLine assigns sequential keys starting at 0", () => {
    const firstLine = new DrawLine();
    const [linesAfterFirst, firstKey] = new Lines().addLine(firstLine);
    const [, secondKey] = linesAfterFirst.addLine(new DrawLine());

    expect(firstKey).toBe("0");
    expect(secondKey).toBe("1");
  });

  it("addLineWithKey stores a line under a given key", () => {
    const line = new DrawLine().addPoint({ x: 1, y: 1 });
    const lines = new Lines().addLineWithKey("firebase-key", line);

    expect(lines.lines.get("firebase-key")?.points.toArray()).toEqual([1, 1]);
  });

  it("addPoint updates the targeted line", () => {
    const [lines, key] = new Lines().addLine(new DrawLine());
    const updated = lines.addPoint(key, { x: 7, y: 8 });

    expect(updated.lines.get(key)?.points.toArray()).toEqual([7, 8]);
  });

  it("endDrawing updates the targeted line", () => {
    const [lines, key] = new Lines().addLine(new DrawLine({ isDrawing: true }));
    const updated = lines.endDrawing(key);

    expect(updated.lines.get(key)?.isDrawing).toBe(false);
  });

  it("updateTimestamp replaces the line timestamp", () => {
    const [lines, key] = new Lines().addLine(new DrawLine({ timestamp: 1 }));
    const updated = lines.updateTimestamp(key, 999);

    expect(updated.lines.get(key)?.timestamp).toBe(999);
  });

  it("getLength returns the number of stored coordinates", () => {
    const [lines, key] = new Lines().addLine(
      new DrawLine().addPoint({ x: 1, y: 2 }),
    );

    expect(lines.getLength(key)).toBe(2);
  });

  it("getCrossingLine returns keys of lines crossed by a segment", () => {
    const crossing = new DrawLine()
      .addPoint({ x: 0, y: 0 })
      .addPoint({ x: 10, y: 10 });
    const safe = new DrawLine()
      .addPoint({ x: 20, y: 0 })
      .addPoint({ x: 30, y: 0 });

    const lines = new Lines()
      .addLineWithKey("a", crossing)
      .addLineWithKey("b", safe);

    expect(lines.getCrossingLine({ x: 0, y: 10 }, { x: 10, y: 0 })).toEqual([
      "a",
    ]);
  });

  it("removeLine deletes the specified keys", () => {
    const lines = new Lines()
      .addLineWithKey("keep", new DrawLine())
      .addLineWithKey("drop", new DrawLine());

    const updated = lines.removeLine("drop");

    expect(updated.lines.has("keep")).toBe(true);
    expect(updated.lines.has("drop")).toBe(false);
  });
});
