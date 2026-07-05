import { describe, expect, it } from "vitest";
import { ViewModel } from "./ViewModel";

describe("ViewModel", () => {
  it("starts at origin with unit scale and zero rotation", () => {
    const viewModel = new ViewModel();
    expect(viewModel.position.x).toBe(0);
    expect(viewModel.position.y).toBe(0);
    expect(viewModel.scale).toBe(1);
    expect(viewModel.rotation).toBe(0);
  });

  it("move shifts position without mutating the original", () => {
    const viewModel = new ViewModel();
    const moved = viewModel.move({ x: 10, y: -5 });

    expect(moved.position.x).toBe(10);
    expect(moved.position.y).toBe(-5);
    expect(viewModel.position.x).toBe(0);
    expect(viewModel.position.y).toBe(0);
  });

  it("scaleAt zooms around a center point", () => {
    const viewModel = new ViewModel().setPosition({ x: 100, y: 0 });
    const scaled = viewModel.scaleAt({ x: 0, y: 0 }, 2);

    expect(scaled.scale).toBe(2);
    expect(scaled.position.x).toBe(200);
    expect(scaled.position.y).toBe(0);
  });

  it("scaleAt clamps scale to min and max", () => {
    const viewModel = new ViewModel().setScale(1);

    expect(viewModel.scaleAt({ x: 0, y: 0 }, 10, 0.1, 5).scale).toBe(5);
    expect(viewModel.scaleAt({ x: 0, y: 0 }, 0.01, 0.1, 5).scale).toBe(0.1);
  });

  it("rotateAt rotates position and accumulates rotation", () => {
    const viewModel = new ViewModel().setPosition({ x: 10, y: 0 });
    const rotated = viewModel.rotateAt({ x: 0, y: 0 }, 90);

    expect(rotated.position.x).toBeCloseTo(0);
    expect(rotated.position.y).toBeCloseTo(10);
    expect(rotated.rotation).toBe(90);
  });

  it("rotateAt wraps rotation with modulo 360", () => {
    const viewModel = new ViewModel().setRotation(350);
    const rotated = viewModel.rotateAt({ x: 0, y: 0 }, 20);

    expect(rotated.rotation).toBe(10);
  });

  it("setters return new instances with updated fields", () => {
    const viewModel = new ViewModel().setPosition({ x: 3, y: 4 }).setScale(2).setRotation(45);

    expect(viewModel.position.x).toBe(3);
    expect(viewModel.position.y).toBe(4);
    expect(viewModel.scale).toBe(2);
    expect(viewModel.rotation).toBe(45);
  });
});
