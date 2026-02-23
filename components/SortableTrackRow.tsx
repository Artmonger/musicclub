'use client';

import { useMemo, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AudioPlayer } from '@/components/AudioPlayer';
import type { Track } from '@/types/database';

/** Object path only (never signed URL). Used for stream + download. */
function objectPath(track: Track): string {
  return track.file_path ?? (track as { storage_path?: string }).storage_path ?? '';
}

function extensionFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext === 'mp3' || ext === 'wav' || ext === 'm4a' ? `.${ext}` : '.m4a';
}

interface SortableTrackRowProps {
  track: Track;
  loadKey?: number; // Changes on each page load → fresh signed URL
  editingTrackId: string | null;
  setEditingTrackId: (id: string | null) => void;
  onUpdateName: (trackId: string, name: string) => void;
  onUpdateNotes: (trackId: string, notes: string) => void;
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
  loadKey,
  editingTrackId,
  setEditingTrackId,
  onUpdateName,
  onUpdateNotes,
  onDelete,
}: SortableTrackRowProps) {
  const [notesExpanded, setNotesExpanded] = useState(false);
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

  const objectPathVal = objectPath(track);
  const displayName = track.title ?? (track as { name?: string }).name ?? 'Track';
  const hasValidPath = objectPathVal.length > 2;

  const streamUrlApi = useMemo(
    () => `/api/stream?id=${encodeURIComponent(track.id)}&load=${loadKey ?? Date.now()}`,
    [track.id, loadKey]
  );

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
              href={`/api/stream?id=${encodeURIComponent(track.id)}&download=1&filename=${encodeURIComponent(displayName)}${extensionFromPath(objectPathVal)}`}
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
          streamUrlApi={streamUrlApi}
          trackName={displayName}
        />
      ) : (
        <p className="text-sm text-amber-500">File path missing.</p>
      )}

      <div className="mt-3 border-t border-[var(--border)] pt-2">
        <button
          type="button"
          onClick={() => setNotesExpanded((prev) => !prev)}
          className="flex w-full items-center gap-2 text-left text-sm text-[var(--muted)] hover:text-[var(--text)]"
          aria-expanded={notesExpanded}
        >
          <svg
            className={`h-4 w-4 shrink-0 transition-transform ${notesExpanded ? 'rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
          </svg>
          Notes
        </button>
        {notesExpanded && (
          <textarea
            defaultValue={track.notes ?? ''}
            onBlur={(e) => {
              const v = e.target.value;
              if (v !== (track.notes ?? '')) onUpdateNotes(track.id, v);
            }}
            placeholder="Add notes…"
            rows={6}
            className="mt-2 w-full resize-y rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm focus:border-[var(--muted)] focus:outline-none"
          />
        )}
      </div>
    </li>
  );
}
