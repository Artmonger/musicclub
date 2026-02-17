'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AudioPlayer } from '@/components/AudioPlayer';
import type { Project } from '@/types/database';
import type { Track } from '@/types/database';

export default function ProjectPage() {
  const params = useParams();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingTrack, setEditingTrack] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) setProject(await res.json());
  }, [id]);

  const fetchTracks = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/tracks`);
    if (res.ok) setTracks(await res.json());
  }, [id]);

  useEffect(() => {
    Promise.all([fetchProject(), fetchTracks()]).finally(() => setLoading(false));
  }, [fetchProject, fetchTracks]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.set('file', file);
        form.set('projectId', id);
        const res = await fetch('/api/upload', { method: 'POST', body: form });
        if (res.ok) await fetchTracks();
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const updateTrack = async (trackId: string, data: { bpm?: number; key?: string; notes?: string; name?: string }) => {
    const res = await fetch('/api/tracks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: trackId, ...data }),
    });
    if (res.ok) {
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, ...data } : t))
      );
      setEditingTrack(null);
    }
  };

  const deleteTrack = async (trackId: string) => {
    if (!confirm('Delete this track?')) return;
    const res = await fetch(`/api/tracks?id=${trackId}`, { method: 'DELETE' });
    if (res.ok) setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  if (loading || !project) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm text-[var(--muted)] hover:underline">
        ← Projects
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{project.name}</h1>
      {project.description && (
        <p className="mt-1 text-sm text-[var(--muted)]">{project.description}</p>
      )}

      <div className="mt-8">
        <label className="inline-block cursor-pointer rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm transition hover:bg-[var(--border)]">
          <input
            type="file"
            accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
            multiple
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
          {uploading ? 'Uploading…' : 'Upload audio (mp3, wav, m4a)'}
        </label>
      </div>

      <ul className="mt-8 space-y-4">
        {tracks.length === 0 ? (
          <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
            No tracks. Upload audio above.
          </li>
        ) : (
          tracks.map((track) => (
            <li
              key={track.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {editingTrack === track.id ? (
                    <input
                      type="text"
                      defaultValue={track.name}
                      className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== track.name) updateTrack(track.id, { name: v });
                        setEditingTrack(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = (e.target as HTMLInputElement).value.trim();
                          if (v) updateTrack(track.id, { name: v });
                          setEditingTrack(null);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingTrack(track.id)}
                      className="text-left font-medium hover:underline"
                    >
                      {track.name}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => deleteTrack(track.id)}
                  className="shrink-0 text-xs text-[var(--muted)] hover:text-red-400"
                >
                  Delete
                </button>
              </div>

              <AudioPlayer
                streamUrlApi={`/api/stream?path=${encodeURIComponent(track.storage_path)}`}
                trackName={track.name}
              />

              <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <div>
                  <span className="text-[var(--muted)]">BPM </span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    defaultValue={track.bpm ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value ? parseInt(e.target.value, 10) : null;
                      updateTrack(track.id, { bpm: v ?? undefined });
                    }}
                    placeholder="—"
                    className="w-16 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1"
                  />
                </div>
                <div>
                  <span className="text-[var(--muted)]">Key </span>
                  <input
                    type="text"
                    defaultValue={track.key ?? ''}
                    onBlur={(e) => updateTrack(track.id, { key: e.target.value.trim() || undefined })}
                    placeholder="e.g. Cm"
                    className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1"
                  />
                </div>
                <div className="sm:col-span-1">
                  <span className="text-[var(--muted)]">Notes </span>
                  <input
                    type="text"
                    defaultValue={track.notes ?? ''}
                    onBlur={(e) => updateTrack(track.id, { notes: e.target.value.trim() || undefined })}
                    placeholder="Notes"
                    className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1"
                  />
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
