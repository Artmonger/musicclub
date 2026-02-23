'use client';

import { useEffect, useState } from 'react';

const KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'Enter', 'KeyE',
]);

export interface KeyState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  interact: boolean;
}

export function useKeyboard(): KeyState {
  const [state, setState] = useState<KeyState>({
    up: false,
    down: false,
    left: false,
    right: false,
    interact: false,
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!KEYS.has(e.code)) return;
      e.preventDefault();
      setState((s) => {
        const next = { ...s };
        switch (e.code) {
          case 'ArrowUp':
          case 'KeyW':
            next.up = true;
            break;
          case 'ArrowDown':
          case 'KeyS':
            next.down = true;
            break;
          case 'ArrowLeft':
          case 'KeyA':
            next.left = true;
            break;
          case 'ArrowRight':
          case 'KeyD':
            next.right = true;
            break;
          case 'Enter':
          case 'KeyE':
            next.interact = true;
            break;
        }
        return next;
      });
    };

    const up = (e: KeyboardEvent) => {
      if (!KEYS.has(e.code)) return;
      e.preventDefault();
      setState((s) => {
        const next = { ...s };
        switch (e.code) {
          case 'ArrowUp':
          case 'KeyW':
            next.up = false;
            break;
          case 'ArrowDown':
          case 'KeyS':
            next.down = false;
            break;
          case 'ArrowLeft':
          case 'KeyA':
            next.left = false;
            break;
          case 'ArrowRight':
          case 'KeyD':
            next.right = false;
            break;
          case 'Enter':
          case 'KeyE':
            next.interact = false;
            break;
        }
        return next;
      });
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return state;
}
