/**
 * Simple AABB collision helpers for the classroom game.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Check if two axis-aligned rectangles overlap.
 */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Check if point (px, py) is inside rect.
 */
export function pointInRect(px: number, py: number, r: Rect): boolean {
  return (
    px >= r.x &&
    px <= r.x + r.width &&
    py >= r.y &&
    py <= r.y + r.height
  );
}

/**
 * Clamp a value to stay within room bounds, accounting for entity size.
 */
export function clampToBounds(
  x: number,
  y: number,
  width: number,
  height: number,
  roomWidth: number,
  roomHeight: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(roomWidth - width, x)),
    y: Math.max(0, Math.min(roomHeight - height, y)),
  };
}

/**
 * Distance between centers of two rects.
 */
export function centerDistance(a: Rect, b: Rect): number {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  return Math.hypot(ax - bx, ay - by);
}
