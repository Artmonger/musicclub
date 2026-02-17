'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AudioPlayer } from '@/components/AudioPlayer';
import type { Project } from '@/types/database';
import type { Track } from '@/types/database';

export default function ProjectPage() {
  const params = useParams();
  const id = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [editingTrack, setEditingTrack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setProject(data);
      setError(null);
    } else {
      setProject(null);
      setError((data.error as string) || res.statusText || 'Failed to load project');
    }
  }, [id]);

  const fetchTracks = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/tracks?t=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const list = Array.isArray(data) ? data : [];
      setTracks(list);
      setError(null);
    } else {
      setTracks([]);
      setError((data.error as string) || res.statusText || 'Failed to load tracks');
    }
  }, [id]);

  const loadFromBackend = useCallback(() => {
    setLoading(true);
    setError(null);
    setTracks([]);
    Promise.all([fetchProject(), fetchTracks()]).finally(() => setLoading(false));
  }, [fetchProject, fetchTracks]);

  useEffect(() => {
    loadFromBackend();
  }, [id, loadFromBackend]);

  useEffect(() => {
    const onFocus = () => loadFromBackend();
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadFromBackend();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadFromBackend]);

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const fileList = input.files ? Array.from(input.files) : [];
      input.value = '';
      if (!fileList.length) return;

      const projectId = id;
      setError(null);
      setUploading(true);

      try {
        for (const file of fileList) {
          try {
            // Stage 1: requesting_url
            setUploadStage(`requesting_url: ${file.name}`);
            console.log('[upload] requesting_url', { projectId, name: file.name, size: file.size, type: file.type });

            const createRes = await fetch('/api/uploads/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId,
                filename: file.name,
                contentType: file.type || 'application/octet-stream',
              }),
              cache: 'no-store',
            });
            const createData = await createRes.json().catch(() => ({}));
            if (!createRes.ok) {
              console.error('[upload] /api/uploads/create failed', createRes.status, createData);
              throw new Error((createData.error as string) || 'Failed to create upload URL');
            }

            const { path, signedUrl } = createData as { path: string; signedUrl: string };
            if (!path || !signedUrl) {
              console.error('[upload] invalid create response', createData);
              throw new Error('Invalid upload URL from server');
            }

            // Stage 2: uploading
            setUploadStage(`uploading: ${file.name}`);
            console.log('[upload] uploading to storage', { projectId, path, size: file.size, type: file.type });

            const uploadRes = await fetch(signedUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': file.type || 'application/octet-stream',
              },
              body: file,
            });

            if (!uploadRes.ok) {
              console.error('[upload] signed upload failed', uploadRes.status, await uploadRes.text().catch(() => ''));

              // Fallback: small files only via API route (Vercel body limits)
              if (file.size <= 4.5 * 1024 * 1024) {
                console.log('[upload] fallback to /api/upload for small file', {
                  projectId,
                  name: file.name,
                  size: file.size,
                });
                const form = new FormData();
                form.set('file', file);
                form.set('projectId', projectId);
                const fallbackRes = await fetch('/api/upload', {
                  method: 'POST',
                  body: form,
                  cache: 'no-store',
                });
                const fallbackData = await fallbackRes.json().catch(() => ({}));
                if (!fallbackRes.ok) {
                  console.error('[upload] /api/upload fallback failed', fallbackRes.status, fallbackData);
                  throw new Error(
                    (fallbackData.error as string) ||
                      `Upload failed (fallback). Try a smaller file or check server logs.`
                  );
                }

                // Fallback path: the API already created the track + storage object.
                setUploadStage(`saving: ${file.name}`);
                await fetchTracks();
                setUploadStage(`done: ${file.name}`);
                continue;
              }

              throw new Error(
                'Upload failed. File may be too large or the signed URL is invalid. Try a smaller file or check logs.'
              );
            }

            // Stage 3: saving (DB row)
            setUploadStage(`saving: ${file.name}`);
            console.log('[upload] saving track row', { projectId, path });

            const saveRes = await fetch('/api/tracks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId,
                title: file.name.replace(/\.[^.]+$/, ''),
                file_path: path,
              }),
              cache: 'no-store',
            });
            const saveData = await saveRes.json().catch(() => ({}));
            if (!saveRes.ok) {
              console.error('[upload] /api/tracks failed', saveRes.status, saveData);
              throw new Error((saveData.error as string) || 'Failed to save track metadata');
            }

            // Stage 4: done
            setUploadStage(`done: ${file.name}`);
            await fetchTracks();
          } catch (fileErr) {
            console.error('[upload] file failed', file.name, fileErr);
            setError(
              fileErr instanceof Error
                ? fileErr.message
                : 'Upload failed. See console for details.'
            );
            break; // stop processing remaining files on first failure
          }
        }
      } finally {
        setUploading(false);
        setUploadStage(null);
      }
    },
    [id, fetchTracks]
  );

  const updateTrack = async (trackId: string, data: { bpm?: number; key?: string; notes?: string; name?: string }) => {
    const res = await fetch('/api/tracks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: trackId, ...data }),
      cache: 'no-store',
    });
    if (res.ok) {
      await fetchTracks();
      setEditingTrack(null);
    }
  };

  const deleteTrack = async (trackId: string) => {
    if (!confirm('Delete this track?')) return;
    const res = await fetch(`/api/tracks?id=${trackId}`, { method: 'DELETE', cache: 'no-store' });
    if (res.ok) await fetchTracks();
  };

  if (loading && !project && !error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-red-400">{error || 'Project not found'}</p>
        <button
          type="button"
          onClick={() => loadFromBackend()}
          className="mt-4 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:underline"
        >
          Refresh from backend
        </button>
        <Link href="/" className="ml-3 text-sm text-[var(--muted)] hover:underline">
          ← Projects
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12" data-page="project">
      <Link href="/" className="text-sm text-[var(--muted)] hover:underline">
        ← Projects
      </Link>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-sm text-[var(--muted)]">{project.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => loadFromBackend()}
          className="shrink-0 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--muted)] hover:underline"
          title="Reload project and tracks from Supabase"
        >
          Refresh from backend
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          {error}
          <button
            type="button"
            onClick={() => loadFromBackend()}
            className="ml-2 font-medium hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4"
          multiple
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
          aria-hidden
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm transition hover:bg-[var(--border)] disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload audio (mp3, wav, m4a)'}
        </button>
        {uploadStage && (
          <span className="text-xs text-[var(--muted)]">
            Stage: {uploadStage}
          </span>
        )}
      </div>

      <ul className="mt-8 space-y-4">
        {tracks.filter((t) => t?.id).length === 0 ? (
          <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
            No tracks. Upload audio above.
          </li>
        ) : (
          tracks.filter((t) => t?.id).map((track) => {
            const streamPath = track.file_path ?? (track as { storage_path?: string }).storage_path ?? '';
            const displayName = track.title ?? (track as { name?: string }).name ?? 'Track';
            return (
            <li
              key={track.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {editingTrack === track.id ? (
                    <input
                      type="text"
                      defaultValue={displayName}
                      className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== displayName) updateTrack(track.id, { name: v });
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
                      {displayName}
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

              {streamPath ? (
                <AudioPlayer
                  streamUrlApi={`/api/stream?path=${encodeURIComponent(streamPath)}`}
                  trackName={displayName}
                />
              ) : (
                <p className="text-sm text-amber-500">File path missing for this track.</p>
              )}

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
          );
          })
        )}
      </ul>
    </div>
  );
}
