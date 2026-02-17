'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AudioPlayer } from '@/components/AudioPlayer';
import type { Project } from '@/types/database';
import type { Track } from '@/types/database';

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

/** Single source of truth: tracks only from GET /api/projects/[id]/tracks (Supabase). No localStorage or other persistence. */
export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [editingTrack, setEditingTrack] = useState<string | null>(null);
  const [savedFeedback, setSavedFeedback] = useState<{ trackId: string; field: string } | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [editingProject, setEditingProject] = useState(false);
  const [projectNameInput, setProjectNameInput] = useState('');
  const [projectDescInput, setProjectDescInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lastTracksResponseRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (savedFeedback) {
      const t = setTimeout(() => setSavedFeedback(null), 2000);
      return () => clearTimeout(t);
    }
  }, [savedFeedback]);

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

  /** Fetches tracks from API, updates state, returns the list. preserveStateIfEmpty: after upload, if API returns [] don't wipe state (keeps optimistic track visible). */
  const fetchTracks = useCallback(
    async (options?: { preserveStateIfEmpty?: boolean }): Promise<Track[]> => {
      const url = `/api/projects/${id}/tracks?t=${Date.now()}`;
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const list = Array.isArray(data) ? data : [];
        lastTracksResponseRef.current = list;
        console.log('[fetchTracks] ok count=%s', list.length, list.length ? list : '');
        const preserve = options?.preserveStateIfEmpty && list.length === 0;
        if (!preserve) setTracks(list);
        setError(null);
        return list as Track[];
      }
      if (!options?.preserveStateIfEmpty) setTracks([]);
      setError((data.error as string) || res.statusText || 'Failed to load tracks');
      return [];
    },
    [id]
  );

  /** Hard refresh: clear in-memory state and re-fetch project + tracks from Supabase only. */
  const loadFromBackend = useCallback(() => {
    setTracks([]);
    setError(null);
    setLoading(true);
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

      const projectId = id; // same as route [id]; used for POST body and GET /api/projects/[id]/tracks
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
                await new Promise((r) => setTimeout(r, 400));
                let list = await fetchTracks({ preserveStateIfEmpty: true });
                for (let retry = 0; retry < 2 && list.length === 0; retry++) {
                  await new Promise((r) => setTimeout(r, 1000));
                  list = await fetchTracks({ preserveStateIfEmpty: true });
                }
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

            // Optimistic: show new track immediately (same shape as GET list)
            const created = (saveData as { track?: Record<string, unknown> }).track;
            if (created && typeof created.id === 'string') {
              const normalized: Track = {
                ...(created as Partial<Track>),
                id: created.id,
                project_id: projectId,
                title: (created.title as string) ?? file.name.replace(/\.[^.]+$/, ''),
                file_path: (created.file_path as string) ?? path,
                name: (created.title as string) ?? (created.name as string) ?? file.name.replace(/\.[^.]+$/, ''),
                storage_path: (created.file_path as string) ?? path,
              } as Track;
              console.log('[upload] created track id=', created.id);
              setTracks((prev) => [normalized, ...prev]);
            }

            // Stage 4: done — refetch from API; if API still returns [] keep optimistic track visible
            setUploadStage(`done: ${file.name}`);
            await new Promise((r) => setTimeout(r, 400));
            let list = await fetchTracks({ preserveStateIfEmpty: true });
            for (let retry = 0; retry < 2 && list.length === 0; retry++) {
              await new Promise((r) => setTimeout(r, 1000));
              list = await fetchTracks({ preserveStateIfEmpty: true });
            }
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

  const updateTrack = async (
    trackId: string,
    data: { bpm?: number; key?: string; notes?: string; name?: string },
    field?: string
  ) => {
    const res = await fetch('/api/tracks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: trackId, ...data }),
      cache: 'no-store',
    });
    if (res.ok) {
      await fetchTracks();
      setEditingTrack(null);
      if (field) setSavedFeedback({ trackId, field });
    }
  };

  const updateProject = async () => {
    const name = projectNameInput.trim();
    if (!name) return;
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: projectDescInput.trim() || null }),
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      setProject(data);
      setEditingProject(false);
    }
  };

  const deleteProject = async () => {
    if (!confirm('Delete this project and all its tracks? This cannot be undone.')) return;
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE', cache: 'no-store' });
    if (res.ok) router.push('/');
  };

  const exportMetadata = () => {
    const payload = {
      project: { id: project?.id, name: project?.name, description: project?.description },
      exportedAt: new Date().toISOString(),
      tracks: tracks.map((t) => ({
        id: t.id,
        title: t.title ?? (t as { name?: string }).name,
        bpm: t.bpm,
        key: t.key,
        notes: t.notes,
        file_path: t.file_path ?? (t as { storage_path?: string }).storage_path,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `project-${project?.name ?? id}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const deleteTrack = async (trackId: string) => {
    if (!confirm('Delete this track?')) return;
    const res = await fetch(`/api/tracks?id=${trackId}`, { method: 'DELETE', cache: 'no-store' });
    if (res.ok) await fetchTracks();
  };

  useEffect(() => {
    if (project) {
      setProjectNameInput(project.name ?? '');
      setProjectDescInput(project.description ?? '');
    }
  }, [project?.id, project?.name, project?.description]);

  const filteredTracks = filterQuery.trim()
    ? tracks.filter((t) => {
        const q = filterQuery.toLowerCase();
        const name = (t.title ?? (t as { name?: string }).name ?? '').toLowerCase();
        const key = (t.key ?? '').toLowerCase();
        const notes = (t.notes ?? '').toLowerCase();
        const bpm = String(t.bpm ?? '');
        return name.includes(q) || key.includes(q) || notes.includes(q) || bpm.includes(q);
      })
    : tracks;

  if (loading && !project && !error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-24 rounded bg-[var(--border)]" />
          <div className="h-8 w-64 rounded bg-[var(--border)]" />
          <div className="h-4 w-full rounded bg-[var(--border)]" />
          <div className="mt-8 flex gap-3">
            <div className="h-10 w-40 rounded bg-[var(--border)]" />
            <div className="h-10 w-24 rounded bg-[var(--border)]" />
          </div>
          <ul className="mt-8 space-y-4">
            {[1, 2, 3].map((i) => (
              <li key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="h-5 w-3/4 rounded bg-[var(--border)]" />
                <div className="mt-3 h-12 w-full rounded bg-[var(--border)]" />
                <div className="mt-3 flex gap-2">
                  <div className="h-8 w-16 rounded bg-[var(--border)]" />
                  <div className="h-8 w-20 rounded bg-[var(--border)]" />
                  <div className="h-8 w-24 rounded bg-[var(--border)]" />
                </div>
              </li>
            ))}
          </ul>
        </div>
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
          Refresh
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
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {editingProject ? (
            <div className="space-y-2">
              <input
                type="text"
                value={projectNameInput}
                onChange={(e) => setProjectNameInput(e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-lg font-semibold"
                placeholder="Project name"
              />
              <input
                type="text"
                value={projectDescInput}
                onChange={(e) => setProjectDescInput(e.target.value)}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                placeholder="Description (optional)"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={updateProject}
                  className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:underline"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingProject(false); setProjectNameInput(project?.name ?? ''); setProjectDescInput(project?.description ?? ''); }}
                  className="text-sm text-[var(--muted)] hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              {project.description && (
                <p className="mt-1 text-sm text-[var(--muted)]">{project.description}</p>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!editingProject && (
            <button
              type="button"
              onClick={() => setEditingProject(true)}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--muted)] hover:underline"
            >
              Edit project
            </button>
          )}
          <button
            type="button"
            onClick={() => loadFromBackend()}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--muted)] hover:underline"
            title="Re-fetch project and tracks from server"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={exportMetadata}
            className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--muted)] hover:underline"
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={deleteProject}
            className="rounded border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Delete project
          </button>
        </div>
      </div>

      {isDev && (
        <>
          <p className="mt-2 text-xs text-[var(--muted)]" aria-live="polite">
            Tracks from API: {tracks.length} — <a href="/api/debug/tracks-total" target="_blank" rel="noopener noreferrer" className="underline">debug</a>
          </p>
          {tracks.length > 0 && lastTracksResponseRef.current.length === 0 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              List may be out of sync. Use Refresh to re-check.
            </p>
          )}
          <details className="mt-4 rounded border border-[var(--border)] bg-[var(--surface)] p-3 text-left">
            <summary className="cursor-pointer text-xs font-medium text-[var(--muted)]">Debug: projectId, API count, raw response</summary>
            <div className="mt-2 space-y-1 text-xs text-[var(--muted)]">
              <p><strong>projectId:</strong> {id}</p>
              <p><strong>count from API:</strong> {lastTracksResponseRef.current.length}</p>
              <pre className="max-h-40 overflow-auto rounded bg-[var(--bg)] p-2 font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(lastTracksResponseRef.current, null, 2)}
              </pre>
            </div>
          </details>
        </>
      )}

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
            {uploadStage}
          </span>
        )}
      </div>

      {tracks.length > 0 && (
        <div className="mt-6">
          <label htmlFor="filter" className="block text-xs text-[var(--muted)] mb-1">
            Filter tracks
          </label>
          <input
            id="filter"
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Name, BPM, key, notes…"
            className="w-full max-w-sm rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
          />
          {filterQuery.trim() && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Showing {filteredTracks.filter((t) => t?.id).length} of {tracks.length} tracks
            </p>
          )}
        </div>
      )}

      {loading ? (
        <ul className="mt-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <li key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="animate-pulse h-5 w-3/4 rounded bg-[var(--border)]" />
              <div className="mt-3 h-12 w-full rounded bg-[var(--border)]" />
              <div className="mt-3 flex gap-2">
                <div className="h-8 w-16 rounded bg-[var(--border)]" />
                <div className="h-8 w-20 rounded bg-[var(--border)]" />
                <div className="h-8 w-24 rounded bg-[var(--border)]" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
      <ul className="mt-8 space-y-4" data-source="supabase" data-track-count={filteredTracks.filter((t) => t?.id).length}>
        {filteredTracks.filter((t) => t?.id).length === 0 ? (
          <>
            <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--muted)]">
              {tracks.length === 0
                ? 'No tracks. Upload audio above.'
                : `No tracks match "${filterQuery.trim()}". Clear the filter or add tracks.`}
            </li>
            {tracks.length === 0 && isDev && (
              <li className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-left text-sm text-amber-700 dark:text-amber-300">
                <strong className="block mb-2">Tracks disappear after refresh?</strong>
                <a href="/api/debug/tracks-total" target="_blank" rel="noopener noreferrer" className="underline">Check /api/debug/tracks-total</a> and Vercel env (SUPABASE_URL, SUPABASE_SECRET_KEY).
              </li>
            )}
          </>
        ) : (
          filteredTracks.filter((t) => t?.id).map((track) => {
            const streamPath = track.file_path ?? (track as { storage_path?: string }).storage_path ?? '';
            const displayName = track.title ?? (track as { name?: string }).name ?? 'Track';
            const hasValidPath = streamPath.includes('/') && streamPath.length > 2;
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
                        if (v && v !== displayName) updateTrack(track.id, { name: v }, 'name');
                        setEditingTrack(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const v = (e.target as HTMLInputElement).value.trim();
                          if (v) updateTrack(track.id, { name: v }, 'name');
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

              {hasValidPath ? (
                <AudioPlayer
                  streamUrlApi={`/api/stream?path=${encodeURIComponent(streamPath)}`}
                  trackName={displayName}
                />
              ) : (
                <p className="text-sm text-amber-500">
                  {streamPath ? 'File path invalid (expected projectId/filename).' : 'File path missing for this track.'}
                </p>
              )}

              <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted)]">BPM</span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    defaultValue={track.bpm ?? ''}
                    onBlur={(e) => {
                      const v = e.target.value ? parseInt(e.target.value, 10) : null;
                      updateTrack(track.id, { bpm: v ?? undefined }, 'bpm');
                    }}
                    placeholder="—"
                    className="w-16 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1"
                  />
                  {savedFeedback?.trackId === track.id && savedFeedback?.field === 'bpm' && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">Saved</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--muted)]">Key</span>
                  <input
                    type="text"
                    defaultValue={track.key ?? ''}
                    onBlur={(e) => updateTrack(track.id, { key: e.target.value.trim() || undefined }, 'key')}
                    placeholder="e.g. Cm"
                    className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1"
                  />
                  {savedFeedback?.trackId === track.id && savedFeedback?.field === 'key' && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 shrink-0">Saved</span>
                  )}
                </div>
                <div className="sm:col-span-1 flex items-center gap-2">
                  <span className="text-[var(--muted)]">Notes</span>
                  <input
                    type="text"
                    defaultValue={track.notes ?? ''}
                    onBlur={(e) => updateTrack(track.id, { notes: e.target.value.trim() || undefined }, 'notes')}
                    placeholder="Notes"
                    className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1"
                  />
                  {savedFeedback?.trackId === track.id && savedFeedback?.field === 'notes' && (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 shrink-0">Saved</span>
                  )}
                </div>
              </div>
            </li>
          );
          })
        )}
      </ul>
      )}
    </div>
  );
}
