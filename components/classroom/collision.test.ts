import { describe, it, expect } from 'vitest';
import {
  rectsOverlap,
  pointInRect,
  clampToBounds,
  centerDistance,
} from './collision';

describe('collision', () => {
  describe('rectsOverlap', () => {
    it('returns true when rects overlap', () => {
      expect(
        rectsOverlap(
          { x: 0, y: 0, width: 10, height: 10 },
          { x: 5, y: 5, width: 10, height: 10 }
        )
      ).toBe(true);
    });

    it('returns false when rects do not overlap', () => {
      expect(
        rectsOverlap(
          { x: 0, y: 0, width: 10, height: 10 },
          { x: 20, y: 20, width: 10, height: 10 }
        )
      ).toBe(false);
    });

    it('returns true when rects touch at edge', () => {
      expect(
        rectsOverlap(
          { x: 0, y: 0, width: 10, height: 10 },
          { x: 10, y: 0, width: 10, height: 10 }
        )
      ).toBe(false);
    });
  });

  describe('pointInRect', () => {
    const r = { x: 10, y: 20, width: 50, height: 30 };
    it('returns true for point inside', () => {
      expect(pointInRect(30, 30, r)).toBe(true);
    });
    it('returns false for point outside', () => {
      expect(pointInRect(0, 0, r)).toBe(false);
      expect(pointInRect(100, 100, r)).toBe(false);
    });
    it('returns true for point on edge', () => {
      expect(pointInRect(10, 20, r)).toBe(true);
      expect(pointInRect(60, 50, r)).toBe(true);
    });
  });

  describe('clampToBounds', () => {
    it('clamps x and y to stay within room', () => {
      const r = clampToBounds(-10, -10, 20, 20, 100, 100);
      expect(r.x).toBe(0);
      expect(r.y).toBe(0);
    });

    it('clamps upper right corner', () => {
      const r = clampToBounds(90, 90, 20, 20, 100, 100);
      expect(r.x).toBe(80);
      expect(r.y).toBe(80);
    });

    it('returns same position when already in bounds', () => {
      const r = clampToBounds(20, 30, 10, 10, 100, 100);
      expect(r.x).toBe(20);
      expect(r.y).toBe(30);
    });
  });

  describe('centerDistance', () => {
    it('returns 0 for same rect', () => {
      const a = { x: 0, y: 0, width: 10, height: 10 };
      expect(centerDistance(a, a)).toBe(0);
    });

    it('returns correct distance between centers', () => {
      const a = { x: 0, y: 0, width: 10, height: 10 };
      const b = { x: 10, y: 0, width: 10, height: 10 };
      expect(centerDistance(a, b)).toBe(10);
    });
  });
});
