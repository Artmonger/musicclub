'use client';

import { useEffect, useRef } from 'react';

export function useGameLoop(onTick: (deltaMs: number) => void, active = true) {
  const rafRef = useRef<number>();
  const lastRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    const tick = (now: number) => {
      const delta = lastRef.current ? now - lastRef.current : 0;
      lastRef.current = now;
      onTick(delta);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [onTick, active]);
}
