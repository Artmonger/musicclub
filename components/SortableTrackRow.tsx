'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AudioPlayer } from '@/components/AudioPlayer';
import type { Track } from '@/types/database';

interface SortableTrackRowProps {
  track: Track;
  editingTrackId: string | null;
  setEditingTrackId: (id: string | null) => void;
  onUpdateName: (trackId: string, name: string) => void;
  onDelete: (trackId: string) => void;
}

function DragHandleIcon() {
  return (
    <svg className="h-4 w-4 text-[var(--muted)]" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

export function SortableTrackRow({
  track,
  editingTrackId,
  setEditingTrackId,
  onUpdateName,
  onDelete,
}: SortableTrackRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const streamPath = track.file_path ?? (track as { storage_path?: string }).storage_path ?? '';
  const displayName = track.title ?? (track as { name?: string }).name ?? 'Track';
  const hasValidPath = streamPath.length > 2;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 ${isDragging ? 'opacity-60 shadow-lg' : ''}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="touch-none cursor-grab active:cursor-grabbing shrink-0 rounded p-1 -ml-1"
            {...listeners}
            {...attributes}
            title="Drag to reorder"
          >
            <DragHandleIcon />
          </span>
          {editingTrackId === track.id ? (
            <input
              type="text"
              defaultValue={displayName}
              className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm font-medium"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== displayName) onUpdateName(track.id, v);
                setEditingTrackId(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) onUpdateName(track.id, v);
                  setEditingTrackId(null);
                }
                if (e.key === 'Escape') setEditingTrackId(null);
              }}
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTrackId(track.id)}
              className="text-left font-medium hover:underline"
            >
              {displayName}
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {hasValidPath && (
            <a
              href={`/api/download?path=${encodeURIComponent(streamPath)}`}
              download
              className="text-xs text-[var(--muted)] hover:underline"
            >
              Download
            </a>
          )}
          <button
            type="button"
            onClick={() => onDelete(track.id)}
            className="text-xs text-[var(--muted)] hover:text-red-400"
          >
            Delete
          </button>
        </div>
      </div>
      {hasValidPath ? (
        <AudioPlayer
          streamUrlApi={`/api/stream?path=${encodeURIComponent(streamPath)}`}
          trackName={displayName}
        />
      ) : (
        <p className="text-sm text-amber-500">File path missing.</p>
      )}
    </li>
  );
}
