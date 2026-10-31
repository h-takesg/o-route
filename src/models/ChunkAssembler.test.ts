import { describe, expect, it } from "vitest";
import { ChunkAssembler } from "./ChunkAssembler";

describe("ChunkAssembler", () => {
  it("releases chunks in order", () => {
    const assembler = new ChunkAssembler();
    expect(assembler.offer(0, [1, 2])).toEqual([1, 2]);
    expect(assembler.offer(1, [3])).toEqual([3]);
    expect(assembler.nextIndex).toBe(2);
  });

  it("buffers out-of-order chunks until contiguous", () => {
    const assembler = new ChunkAssembler();
    expect(assembler.offer(2, [30])).toEqual([]);
    expect(assembler.offer(0, [10])).toEqual([10]);
    expect(assembler.offer(1, [20])).toEqual([20, 30]);
    expect(assembler.nextIndex).toBe(3);
  });

  it("ignores duplicate indices", () => {
    const assembler = new ChunkAssembler();
    expect(assembler.offer(0, [1])).toEqual([1]);
    expect(assembler.offer(0, [9])).toEqual([]);
    expect(assembler.offer(1, [2])).toEqual([2]);
    expect(assembler.offer(1, [8])).toEqual([]);
  });

  it("advances on empty chunk to skip failures", () => {
    const assembler = new ChunkAssembler();
    expect(assembler.offer(0, [])).toEqual([]);
    expect(assembler.nextIndex).toBe(1);
    expect(assembler.offer(1, [5])).toEqual([5]);
  });

  it("reset clears state", () => {
    const assembler = new ChunkAssembler();
    assembler.offer(0, [1]);
    assembler.offer(2, [3]);
    assembler.reset();
    expect(assembler.nextIndex).toBe(0);
    expect(assembler.offer(0, [7])).toEqual([7]);
  });
});
