/**
 * Deterministic grid layout for artist NPCs in the classroom.
 * Places artists in a grid with spacing, wrapping rows, avoiding overlaps.
 */

export interface ArtistSpawn {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutConfig {
  roomWidth: number;
  roomHeight: number;
  margin: number;
  npcWidth: number;
  npcHeight: number;
  spacingX: number;
  spacingY: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
  roomWidth: 800,
  roomHeight: 600,
  margin: 60,
  npcWidth: 32,
  npcHeight: 40,
  spacingX: 48,
  spacingY: 56,
};

/**
 * Compute grid positions for artists. Deterministic: same artists yield same layout.
 */
export function layoutArtists(
  artists: { id: string; name: string }[],
  config: Partial<LayoutConfig> = {}
): ArtistSpawn[] {
  const c = { ...DEFAULT_CONFIG, ...config };
  const cols = Math.floor(
    (c.roomWidth - 2 * c.margin + c.spacingX) / (c.npcWidth + c.spacingX)
  );
  const rows = Math.ceil(artists.length / Math.max(1, cols));

  return artists.map((a, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = c.margin + col * (c.npcWidth + c.spacingX);
    const y = c.margin + row * (c.npcHeight + c.spacingY);
    return {
      id: a.id,
      name: a.name,
      x,
      y,
      width: c.npcWidth,
      height: c.npcHeight,
    };
  });
}
