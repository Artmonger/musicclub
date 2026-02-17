'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Project } from '@/types/database';

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const fetchProjects = async () => {
    const res = await fetch('/api/projects');
    if (res.ok) {
      const data = await res.json();
      setProjects(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || null }),
      });
      if (res.ok) {
        const project = await res.json();
        setProjects((p) => [project, ...p]);
        setNewName('');
        setNewDesc('');
      }
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (p: Project) => {
    setEditingId(p.id);
    setEditName(p.name ?? '');
    setEditDesc(p.description ?? '');
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    const res = await fetch(`/api/projects/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
      cache: 'no-store',
    });
    if (res.ok) {
      const updated = await res.json();
      setProjects((prev) => prev.map((x) => (x.id === editingId ? updated : x)));
      setEditingId(null);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm('Delete this project and all its tracks? This cannot be undone.')) return;
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE', cache: 'no-store' });
    if (res.ok) setProjects((prev) => prev.filter((x) => x.id !== projectId));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Private music project management</p>

      <form onSubmit={createProject} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="name" className="block text-xs text-[var(--muted)]">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--muted)] focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="desc" className="block text-xs text-[var(--muted)]">
            Description (optional)
          </label>
          <input
            id="desc"
            type="text"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description"
            className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--muted)] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--border)] disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'New project'}
        </button>
      </form>

      <ul className="mt-10 space-y-1">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <li key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                <div className="animate-pulse h-5 w-48 rounded bg-[var(--border)]" />
                <div className="mt-1 h-4 w-32 rounded bg-[var(--border)]" />
              </li>
            ))}
          </>
        ) : projects.length === 0 ? (
          <li className="py-8 text-sm text-[var(--muted)]">No projects yet. Create one above.</li>
        ) : (
          projects.map((p) => (
            <li key={p.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              {editingId === p.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
                    placeholder="Project name"
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                    placeholder="Description (optional)"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:underline"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-sm text-[var(--muted)] hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/project/${p.id}`}
                    className="min-w-0 flex-1 transition hover:underline"
                  >
                    <span className="font-medium">{p.name}</span>
                    {p.description && (
                      <span className="ml-2 text-sm text-[var(--muted)]">{p.description}</span>
                    )}
                  </Link>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="text-xs text-[var(--muted)] hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); deleteProject(p.id); }}
                      className="text-xs text-[var(--muted)] hover:text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
