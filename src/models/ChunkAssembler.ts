class ChunkAssembler {
  private expectedIndex = 0;
  private readonly pending = new Map<number, number[]>();

  get nextIndex(): number {
    return this.expectedIndex;
  }

  offer(index: number, values: number[]): number[] {
    if (!Number.isInteger(index) || index < 0) {
      return [];
    }
    if (index < this.expectedIndex || this.pending.has(index)) {
      return [];
    }
    this.pending.set(index, values);
    const released: number[] = [];
    while (this.pending.has(this.expectedIndex)) {
      const chunk = this.pending.get(this.expectedIndex)!;
      this.pending.delete(this.expectedIndex);
      released.push(...chunk);
      this.expectedIndex += 1;
    }
    return released;
  }

  reset(): void {
    this.expectedIndex = 0;
    this.pending.clear();
  }
}

export { ChunkAssembler };
