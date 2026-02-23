'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { layoutArtists, type ArtistSpawn } from './layoutArtists';
import { clampToBounds, centerDistance, type Rect } from './collision';
import { useGameLoop } from './useGameLoop';
import { useKeyboard } from './useKeyboard';
import { InteractPrompt } from './ui/InteractPrompt';
import { DialogOverlay } from './ui/DialogOverlay';
import type { Artist } from '@/types/database';

const ROOM_WIDTH = 800;
const ROOM_HEIGHT = 600;
const PLAYER_WIDTH = 20;
const PLAYER_HEIGHT = 28;
const SPEED = 0.2;
const INTERACTION_RADIUS = 40;

const DESKS: Rect[] = [
  { x: 200, y: 150, width: 80, height: 50 },
  { x: 520, y: 150, width: 80, height: 50 },
  { x: 200, y: 400, width: 80, height: 50 },
  { x: 520, y: 400, width: 80, height: 50 },
];

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function ClassroomScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState({ x: ROOM_WIDTH / 2 - PLAYER_WIDTH / 2, y: ROOM_HEIGHT - 80 });
  const [nearbyNpc, setNearbyNpc] = useState<ArtistSpawn | null>(null);
  const [dialogArtist, setDialogArtist] = useState<ArtistSpawn | null>(null);
  const keys = useKeyboard();

  const npcs = layoutArtists(artists, {
    roomWidth: ROOM_WIDTH,
    roomHeight: ROOM_HEIGHT,
  });

  const onTick = useCallback(
    (delta: number) => {
      setPlayer((p) => {
        let dx = 0;
        let dy = 0;
        if (keys.up) dy -= 1;
        if (keys.down) dy += 1;
        if (keys.left) dx -= 1;
        if (keys.right) dx += 1;
        if (dx === 0 && dy === 0) return p;

        const mag = Math.hypot(dx, dy) || 1;
        const nx = p.x + (dx / mag) * SPEED * delta;
        const ny = p.y + (dy / mag) * SPEED * delta;

        const clamped = clampToBounds(
          nx,
          ny,
          PLAYER_WIDTH,
          PLAYER_HEIGHT,
          ROOM_WIDTH,
          ROOM_HEIGHT
        );

        const playerRect: Rect = {
          x: clamped.x,
          y: clamped.y,
          width: PLAYER_WIDTH,
          height: PLAYER_HEIGHT,
        };
        for (const desk of DESKS) {
          if (rectsOverlap(playerRect, desk)) {
            return p;
          }
        }
        return { x: clamped.x, y: clamped.y };
      });
    },
    [keys.up, keys.down, keys.left, keys.right]
  );

  useGameLoop(onTick, !dialogArtist);

  useEffect(() => {
    const fetchArtists = async () => {
      const res = await fetch('/api/artists', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setArtists(data);
      }
      setLoading(false);
    };
    fetchArtists();
  }, []);

  useEffect(() => {
    const playerRect: Rect = {
      x: player.x,
      y: player.y,
      width: PLAYER_WIDTH,
      height: PLAYER_HEIGHT,
    };
    let found: ArtistSpawn | null = null;
    for (const npc of npcs) {
      const dist = centerDistance(playerRect, { ...npc });
      if (dist < INTERACTION_RADIUS) {
        found = npc;
        break;
      }
    }
    setNearbyNpc(found);
  }, [player, npcs]);

  useEffect(() => {
    if (keys.interact && nearbyNpc && !dialogArtist) {
      setDialogArtist(nearbyNpc);
    }
  }, [keys.interact, nearbyNpc, dialogArtist]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#e8e4dc';
    ctx.fillRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    ctx.strokeStyle = '#c4b8a8';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, ROOM_WIDTH, ROOM_HEIGHT);

    for (const d of DESKS) {
      ctx.fillStyle = '#b8a898';
      ctx.fillRect(d.x, d.y, d.width, d.height);
      ctx.strokeStyle = '#a09080';
      ctx.strokeRect(d.x, d.y, d.width, d.height);
    }

    for (const npc of npcs) {
      ctx.fillStyle = '#6b8e9e';
      ctx.fillRect(npc.x, npc.y, npc.width, npc.height);
      ctx.fillStyle = '#333';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'center';
      const label = npc.name.length > 12 ? npc.name.slice(0, 10) + '…' : npc.name;
      ctx.fillText(label, npc.x + npc.width / 2, npc.y - 6);
    }

    ctx.fillStyle = '#2d5a4a';
    ctx.fillRect(player.x, player.y, PLAYER_WIDTH, PLAYER_HEIGHT);
  }, [player, npcs]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-[var(--muted)]">Loading classroom…</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <canvas
        ref={canvasRef}
        width={ROOM_WIDTH}
        height={ROOM_HEIGHT}
        className="block"
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', margin: 'auto' }}
        aria-label="Classroom scene with artist NPCs"
      />
      <InteractPrompt
        name={nearbyNpc?.name ?? ''}
        visible={!!nearbyNpc && !dialogArtist}
      />
      {dialogArtist && (
        <DialogOverlay
          artistName={dialogArtist.name}
          artistId={dialogArtist.id}
          onCancel={() => setDialogArtist(null)}
        />
      )}
    </div>
  );
}
