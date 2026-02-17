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
          <li className="py-4 text-sm text-[var(--muted)]">Loading…</li>
        ) : projects.length === 0 ? (
          <li className="py-8 text-sm text-[var(--muted)]">No projects yet. Create one above.</li>
        ) : (
          projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/project/${p.id}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:border-[var(--muted)]"
              >
                <span className="font-medium">{p.name}</span>
                {p.description && (
                  <span className="ml-2 text-sm text-[var(--muted)]">{p.description}</span>
                )}
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
