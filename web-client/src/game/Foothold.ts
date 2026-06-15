/**
 * Foothold-based terrain (the MapleStory way). Instead of box colliders, the
 * ground is a set of line segments characters walk along; this supports slopes
 * and one-way platforms naturally. A character finds the segment beneath its x
 * and lands on the interpolated y.
 */
export interface FootholdSeg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export class FootholdMap {
  constructor(public readonly segments: FootholdSeg[]) {}

  /** Y of a segment at world-x, or null if x is outside it. */
  private yOn(seg: FootholdSeg, x: number): number | null {
    const lo = Math.min(seg.x1, seg.x2);
    const hi = Math.max(seg.x1, seg.x2);
    if (x < lo || x > hi) return null;
    const t = seg.x2 === seg.x1 ? 0 : (x - seg.x1) / (seg.x2 - seg.x1);
    return seg.y1 + t * (seg.y2 - seg.y1);
  }

  /**
   * Find the surface a falling character should land on this frame: a segment
   * under `x` whose y the feet cross between `prevFeetY` and `nextFeetY`. Picks
   * the highest such surface. Returns null if there's nothing to land on.
   */
  landingY(x: number, prevFeetY: number, nextFeetY: number): number | null {
    let best: number | null = null;
    for (const seg of this.segments) {
      const y = this.yOn(seg, x);
      if (y === null) continue;
      if (prevFeetY <= y + 2 && nextFeetY >= y) {
        if (best === null || y < best) best = y;
      }
    }
    return best;
  }

  /** Y of whatever ground is directly under x (for placing entities). */
  groundUnder(x: number, fromY = -Infinity): number | null {
    let best: number | null = null;
    for (const seg of this.segments) {
      const y = this.yOn(seg, x);
      if (y === null || y < fromY) continue;
      if (best === null || y < best) best = y;
    }
    return best;
  }
}
