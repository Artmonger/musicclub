'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AudioPlayer } from '@/components/AudioPlayer';
import type { Project } from '@/types/database';
import type { Track } from '@/types/database';

/** Single source of truth: GET /api/projects/[id] and GET /api/projects/[id]/tracks. */
export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id && String(params.id).trim()) || '';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);

  async function loadAll() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [projectRes, tracksRes] = await Promise.all([
        fetch(`/api/projects/${id}`, { cache: 'no-store' }),
        fetch(`/api/projects/${id}/tracks`, { cache: 'no-store' }),
      ]);
      const projectData = await projectRes.json().catch(() => ({}));
      const tracksData = await tracksRes.json().catch(() => ({}));
      if (projectRes.ok) {
        setProject(projectData);
      } else {
        setProject(null);
        setError((projectData.error as string) || 'Failed to load project');
      }
      if (tracksRes.ok) {
        const list = Array.isArray(tracksData) ? tracksData : [];
        setTracks(list as Track[]);
        if (!projectRes.ok) setError(null);
      } else {
        setTracks([]);
        if (projectRes.ok) setError((tracksData.error as string) || 'Failed to load tracks');
      }
    } finally {
      setLoading(false);
    }
  }

  async function reloadTracks() {
    if (!id) return;
    const res = await fetch(`/api/projects/${id}/tracks`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setTracks(Array.isArray(data) ? (data as Track[]) : []);
  }

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (!files.length || !id) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of files) {
        const createRes = await fetch('/api/uploads/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: id,
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
          }),
          cache: 'no-store',
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok) throw new Error((createData.error as string) || 'Failed to create upload URL');
        const { path, signedUrl } = createData as { path: string; signedUrl: string };
        if (!path || !signedUrl) throw new Error('Invalid upload URL');

        const putRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!putRes.ok) throw new Error('Upload to storage failed');

        const postRes = await fetch('/api/tracks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: id,
            title: file.name.replace(/\.[^.]+$/, '') || 'Untitled',
            file_path: path,
          }),
          cache: 'no-store',
        });
        const postData = await postRes.json().catch(() => ({}));
        if (!postRes.ok) throw new Error((postData.error as string) || 'Failed to save track');
        await reloadTracks();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const updateTrackName = async (trackId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await fetch('/api/tracks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: trackId, name: trimmed }),
      cache: 'no-store',
    });
    if (res.ok) {
      await reloadTracks();
      setEditingTrackId(null);
    }
  };

  const deleteTrack = async (trackId: string) => {
    if (!confirm('Delete this track?')) return;
    const res = await fetch(`/api/tracks?id=${trackId}`, { method: 'DELETE', cache: 'no-store' });
    if (res.ok) await reloadTracks();
  };

  const clearAllTracks = async () => {
    if (!confirm('Remove all tracks from this project?')) return;
    const res = await fetch(`/api/projects/${id}/tracks`, { method: 'DELETE', cache: 'no-store' });
    if (res.ok) await reloadTracks();
  };

  const deleteProject = async () => {
    if (!confirm('Delete this project and all its tracks?')) return;
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE', cache: 'no-store' });
    if (res.ok) router.push('/');
  };

  if (!id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-red-400">Invalid project URL.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-[var(--muted)] hover:underline">← Projects</Link>
      </div>
    );
  }

  if (loading && !project && !error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 rounded bg-[var(--border)]" />
          <div className="h-8 w-64 rounded bg-[var(--border)]" />
          <div className="mt-8 h-10 w-40 rounded bg-[var(--border)]" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-red-400">{error || 'Project not found'}</p>
        <button type="button" onClick={() => loadAll()} className="mt-4 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:underline">Refresh</button>
        <Link href="/" className="ml-3 text-sm text-[var(--muted)] hover:underline">← Projects</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12" data-page="project">
      <Link href="/" className="text-sm text-[var(--muted)] hover:underline">← Projects</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          {project.description && <p className="mt-1 text-sm text-[var(--muted)]">{project.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => loadAll()} className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--muted)] hover:underline">Refresh</button>
          <button type="button" onClick={clearAllTracks} disabled={tracks.length === 0} className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--muted)] hover:underline disabled:opacity-50">Clear all tracks</button>
          <button type="button" onClick={deleteProject} className="rounded border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:underline">Delete project</button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
          {error}
          <button type="button" onClick={() => loadAll()} className="ml-2 font-medium hover:underline">Retry</button>
        </div>
      )}

      <div className="mt-8 flex items-center gap-3">
        <input ref={fileInputRef} type="file" accept=".mp3,.wav,.m4a,audio/mpeg,audio/wav,audio/mp4" multiple className="hidden" onChange={handleUpload} disabled={uploading} aria-hidden />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm hover:bg-[var(--border)] disabled:opacity-50">
          {uploading ? 'Uploading…' : 'Upload audio (mp3, wav, m4a)'}
        </button>
      </div>

      <ul className="mt-8 space-y-4">
        {tracks.length === 0 ? (
          <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
            No tracks. Upload audio above.
          </li>
        ) : (
          tracks.map((track) => {
            const streamPath = track.file_path ?? (track as { storage_path?: string }).storage_path ?? '';
            const displayName = track.title ?? (track as { name?: string }).name ?? 'Track';
            const hasValidPath = streamPath.length > 2;
            return (
              <li key={track.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  {editingTrackId === track.id ? (
                    <input
                      type="text"
                      defaultValue={displayName}
                      className="min-w-0 flex-1 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm font-medium"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== displayName) updateTrackName(track.id, v);
                        setEditingTrackId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = (e.target as HTMLInputElement).value.trim();
                          if (v) updateTrackName(track.id, v);
                          setEditingTrackId(null);
                        }
                        if (e.key === 'Escape') setEditingTrackId(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <button type="button" onClick={() => setEditingTrackId(track.id)} className="text-left font-medium hover:underline">
                      {displayName}
                    </button>
                  )}
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
                    <button type="button" onClick={() => deleteTrack(track.id)} className="text-xs text-[var(--muted)] hover:text-red-400">Delete</button>
                  </div>
                </div>
                {hasValidPath ? (
                  <AudioPlayer streamUrlApi={`/api/stream?path=${encodeURIComponent(streamPath)}`} trackName={displayName} />
                ) : (
                  <p className="text-sm text-amber-500">File path missing.</p>
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
