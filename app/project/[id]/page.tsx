'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { SortableTrackRow } from '@/components/SortableTrackRow';
import type { Project } from '@/types/database';
import type { Track } from '@/types/database';

const ORDER_KEY = (projectId: string) => `trackOrder:${projectId}`;

/** Infer audio Content-Type from filename when file.type is missing/unknown (e.g. iOS). */
function inferContentType(filename: string, fileType: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const byExt: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
  };
  if (byExt[ext]) return byExt[ext];
  if (fileType && fileType !== 'application/octet-stream') return fileType;
  return 'application/octet-stream';
}

function loadOrderFromStorage(projectId: string): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY(projectId));
    const saved = raw ? JSON.parse(raw) : [];
    if (Array.isArray(saved) && saved.every((x) => typeof x === 'string')) return saved;
  } catch {
    /* localStorage unavailable or invalid */
  }
  return [];
}

function saveOrderToStorage(projectId: string, orderedIds: string[]) {
  try {
    localStorage.setItem(ORDER_KEY(projectId), JSON.stringify(orderedIds));
  } catch {
    /* ignore */
  }
}

/** Single source of truth: GET /api/projects/[id] and GET /api/projects/[id]/tracks. */
export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params?.id && String(params.id).trim()) || '';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);

  // Hydrate order from localStorage when project id is known (or clear when switching project)
  useEffect(() => {
    if (!id) return;
    setOrderedIds(loadOrderFromStorage(id));
  }, [id]);

  // Persist order whenever orderedIds changes
  useEffect(() => {
    if (!id) return;
    saveOrderToStorage(id, orderedIds);
  }, [id, orderedIds]);

  // Reconcile orderedIds with fetched tracks: remove deleted, append new, init if empty
  useEffect(() => {
    if (tracks.length === 0) return;
    const incomingIds = tracks.map((t) => t.id);
    setOrderedIds((prev) => {
      if (prev.length === 0) return incomingIds;
      const trackSet = new Set(incomingIds);
      const kept = prev.filter((tid) => trackSet.has(tid));
      const newIds = incomingIds.filter((tid) => !prev.includes(tid));
      return [...kept, ...newIds];
    });
  }, [tracks]);

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
        const contentType = inferContentType(file.name, file.type || '');
        console.log('[upload] inferred contentType=%s filename=%s', contentType, file.name);

        const createRes = await fetch('/api/uploads/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: id,
            filename: file.name,
            contentType,
          }),
          cache: 'no-store',
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok) throw new Error((createData.error as string) || 'Failed to create upload URL');
        const { path, signedUrl } = createData as { path: string; signedUrl: string };
        if (!path || !signedUrl) throw new Error('Invalid upload URL');

        const putRes = await fetch(signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
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

  const deleteProject = async () => {
    if (!confirm('Delete this project and all its tracks?')) return;
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE', cache: 'no-store' });
    if (res.ok) router.push('/');
  };

  const byId = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const orderedTracks = useMemo(
    () => orderedIds.map((tid) => byId.get(tid)).filter(Boolean) as Track[],
    [orderedIds, byId]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = orderedIds.indexOf(active.id as string);
      const newIndex = orderedIds.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) {
        setOrderedIds(arrayMove(orderedIds, oldIndex, newIndex));
      }
    }
  };

  if (!id) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-red-400">Invalid project URL.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-[var(--muted)] hover:underline">← Artists</Link>
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
        <Link href="/" className="mt-4 inline-block text-sm text-[var(--muted)] hover:underline">← Artists</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12" data-page="project">
      <Link href={project.artist_id ? `/artist/${project.artist_id}` : '/'} className="text-sm text-[var(--muted)] hover:underline">
        ← {project.artist_id ? 'Artist' : 'Artists'}
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          {project.description && <p className="mt-1 text-sm text-[var(--muted)]">{project.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              {orderedTracks.map((track) => (
                <SortableTrackRow
                  key={track.id}
                  track={track}
                  editingTrackId={editingTrackId}
                  setEditingTrackId={setEditingTrackId}
                  onUpdateName={updateTrackName}
                  onDelete={deleteTrack}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </ul>
    </div>
  );
}
