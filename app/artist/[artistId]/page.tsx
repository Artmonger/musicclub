'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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
import { SortableProjectRow } from '@/components/SortableProjectRow';
import type { Artist } from '@/types/database';
import type { Project } from '@/types/database';

const PROJECT_ORDER_KEY = (artistId: string) => `projectOrder:${artistId}`;

function loadProjectOrder(artistId: string): string[] {
  try {
    const raw = localStorage.getItem(PROJECT_ORDER_KEY(artistId));
    const saved = raw ? JSON.parse(raw) : [];
    if (Array.isArray(saved) && saved.every((x) => typeof x === 'string')) return saved;
  } catch {
    /* localStorage unavailable or invalid */
  }
  return [];
}

function saveProjectOrder(artistId: string, orderedIds: string[]) {
  try {
    localStorage.setItem(PROJECT_ORDER_KEY(artistId), JSON.stringify(orderedIds));
  } catch {
    /* ignore */
  }
}

export default function ArtistPage() {
  const params = useParams();
  const artistId = (params?.artistId && String(params.artistId).trim()) || '';
  const [artist, setArtist] = useState<Artist | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');

  const loadAll = async () => {
    if (!artistId) return;
    setLoading(true);
    try {
      const [artistsRes, projectsRes] = await Promise.all([
        fetch('/api/artists', { cache: 'no-store' }),
        fetch(`/api/projects?artistId=${encodeURIComponent(artistId)}`, { cache: 'no-store' }),
      ]);
      const artistsData = await artistsRes.json().catch(() => []);
      const projectsData = await projectsRes.json().catch(() => []);
      const found = Array.isArray(artistsData)
        ? (artistsData as Artist[]).find((a) => a.id === artistId)
        : null;
      setArtist(found ?? null);
      setProjects(Array.isArray(projectsData) ? projectsData : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (artistId) setOrderedIds(loadProjectOrder(artistId));
  }, [artistId]);

  useEffect(() => {
    loadAll();
  }, [artistId]);

  useEffect(() => {
    if (artistId) saveProjectOrder(artistId, orderedIds);
  }, [artistId, orderedIds]);

  useEffect(() => {
    if (projects.length === 0) return;
    const incomingIds = projects.map((p) => p.id);
    setOrderedIds((prev) => {
      if (prev.length === 0) return incomingIds;
      const projectSet = new Set(incomingIds);
      const kept = prev.filter((id) => projectSet.has(id));
      const newIds = incomingIds.filter((id) => !prev.includes(id));
      return [...kept, ...newIds];
    });
  }, [projects]);

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !artistId) return;
    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistId, name: newName.trim() }),
        cache: 'no-store',
      });
      if (res.ok) {
        const project = await res.json();
        setProjects((p) => [project, ...p]);
        setNewName('');
      }
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm('Delete this project and all its tracks?')) return;
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE', cache: 'no-store' });
    if (res.ok) setProjects((p) => p.filter((x) => x.id !== projectId));
  };

  const startRename = () => {
    setEditName(artist?.name ?? '');
    setEditingName(true);
  };

  const saveRename = async () => {
    if (!artistId || !editName.trim()) {
      setEditingName(false);
      return;
    }
    const res = await fetch('/api/artists', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: artistId, name: editName.trim() }),
      cache: 'no-store',
    });
    if (res.ok) {
      const updated = await res.json();
      setArtist(updated);
      setEditingName(false);
    }
  };

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

  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const orderedProjects = useMemo(
    () => orderedIds.map((id) => byId.get(id)).filter(Boolean) as Project[],
    [orderedIds, byId]
  );

  const deleteArtist = async () => {
    if (!confirm('Delete this artist and all their projects and tracks? This cannot be undone.')) return;
    const res = await fetch(`/api/artists?id=${encodeURIComponent(artistId)}`, { method: 'DELETE', cache: 'no-store' });
    if (res.ok) {
      window.location.href = '/';
    }
  };

  if (!artistId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-sm text-[var(--muted)]">Invalid artist.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link
        href="/"
        className="mb-4 inline-block text-sm text-[var(--muted)] hover:underline"
      >
        ← Back to Classroom
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {editingName ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveRename()}
              className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-xl font-semibold"
              autoFocus
            />
            <button type="button" onClick={saveRename} className="text-sm hover:underline">Save</button>
            <button type="button" onClick={() => setEditingName(false)} className="text-sm text-[var(--muted)] hover:underline">Cancel</button>
          </div>
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight">
            {loading ? '…' : artist?.name ?? 'Artist'}
          </h1>
        )}
        <div className="flex gap-2">
          {!editingName && artist && (
            <button type="button" onClick={startRename} className="text-sm text-[var(--muted)] hover:underline">Rename</button>
          )}
          <button type="button" onClick={deleteArtist} className="text-sm text-red-500 hover:underline">Delete artist</button>
        </div>
      </div>

      <form onSubmit={createProject} className="mt-8 flex gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Project name"
          className="flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--muted)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--border)] disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'New Project'}
        </button>
      </form>

      <ul className="mt-10 space-y-2">
        {loading ? (
          [1, 2, 3].map((i) => (
            <li key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
              <div className="h-6 w-48 animate-pulse rounded bg-[var(--border)]" />
            </li>
          ))
        ) : projects.length === 0 ? (
          <li className="py-8 text-sm text-[var(--muted)]">No projects yet. Create one above.</li>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              {orderedProjects.map((p) => (
                <SortableProjectRow key={p.id} project={p} onDelete={deleteProject} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </ul>
    </div>
  );
}
