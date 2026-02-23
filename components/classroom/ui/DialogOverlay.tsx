'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface DialogOverlayProps {
  artistName: string;
  artistId: string;
  onCancel: () => void;
}

export function DialogOverlay({
  artistName,
  artistId,
  onCancel,
}: DialogOverlayProps) {
  const router = useRouter();

  const openArtist = () => {
    router.push(`/artist/${artistId}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        router.push(`/artist/${artistId}`);
      }
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [artistId, router, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xl">
        <h2 id="dialog-title" className="text-lg font-semibold">
          Hi, I&apos;m {artistName}
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Press Enter to open or choose below.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={openArtist}
            className="flex-1 rounded border border-[var(--border)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Open Artist Page
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm hover:bg-[var(--border)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
