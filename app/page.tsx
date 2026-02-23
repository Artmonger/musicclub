'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClassroomScene } from '@/components/classroom/ClassroomScene';
import type { Artist } from '@/types/database';

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefers(mq.matches);
    const on = () => setPrefers(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return prefers;
}

function ArtistsListContent({
  artists,
  loading,
  newName,
  setNewName,
  creating,
  createArtist,
}: {
  artists: Artist[];
  loading: boolean;
  newName: string;
  setNewName: (s: string) => void;
  creating: boolean;
  createArtist: (e: React.FormEvent) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Artists</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Create artists, then add projects under each</p>

      <form onSubmit={createArtist} className="mt-8 flex gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Artist name"
          className="flex-1 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--muted)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium transition hover:bg-[var(--border)] disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'New Artist'}
        </button>
      </form>

      <ul className="mt-10 space-y-2">
        {loading ? (
          [1, 2, 3].map((i) => (
            <li key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
              <div className="h-6 w-48 animate-pulse rounded bg-[var(--border)]" />
            </li>
          ))
        ) : artists.length === 0 ? (
          <li className="py-8 text-sm text-[var(--muted)]">No artists yet. Create one above.</li>
        ) : (
          artists.map((a) => (
            <li key={a.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
              <Link
                href={`/artist/${a.id}`}
                className="block font-medium transition hover:underline"
              >
                {a.name}
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export default function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const prefersReducedMotion = usePrefersReducedMotion();
  const [listView, setListView] = useState(false);

  const fetchArtists = async () => {
    const res = await fetch('/api/artists', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      setArtists(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchArtists();
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) setListView(true);
  }, [prefersReducedMotion]);

  const createArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/artists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
        cache: 'no-store',
      });
      if (res.ok) {
        const artist = await res.json();
        setArtists((a) => [artist, ...a]);
        setNewName('');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="fixed right-4 top-4 z-40 flex gap-2">
        <button
          type="button"
          onClick={() => setListView(!listView)}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm shadow"
        >
          {listView ? 'Classroom' : 'List view'}
        </button>
      </div>

      {!listView ? (
        <ClassroomScene />
      ) : (
        <ArtistsListContent
          artists={artists}
          loading={loading}
          newName={newName}
          setNewName={setNewName}
          creating={creating}
          createArtist={createArtist}
        />
      )}
    </>
  );
}
