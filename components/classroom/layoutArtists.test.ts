import { describe, it, expect } from 'vitest';
import { layoutArtists } from './layoutArtists';

describe('layoutArtists', () => {
  it('returns empty array for empty input', () => {
    expect(layoutArtists([])).toEqual([]);
  });

  it('places a single artist at margin position', () => {
    const artists = [{ id: 'a1', name: 'Alice' }];
    const result = layoutArtists(artists, { margin: 60, npcWidth: 32, npcHeight: 40 });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'a1',
      name: 'Alice',
      x: 60,
      y: 60,
      width: 32,
      height: 40,
    });
  });

  it('places multiple artists in a grid', () => {
    const artists = [
      { id: 'a1', name: 'Alice' },
      { id: 'a2', name: 'Bob' },
      { id: 'a3', name: 'Carol' },
    ];
    const result = layoutArtists(artists);
    expect(result).toHaveLength(3);
    expect(result[0].x).toBeLessThan(result[1].x);
    expect(result[1].x).toBeLessThan(result[2].x);
  });

  it('is deterministic for same input', () => {
    const artists = [
      { id: 'x', name: 'X' },
      { id: 'y', name: 'Y' },
    ];
    const a = layoutArtists(artists);
    const b = layoutArtists(artists);
    expect(a).toEqual(b);
  });
});
