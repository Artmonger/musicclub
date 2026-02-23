'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';
import type { Project } from '@/types/database';

interface SortableProjectRowProps {
  project: Project;
  onDelete: (projectId: string) => void;
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

export function SortableProjectRow({ project, onDelete }: SortableProjectRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4 ${isDragging ? 'opacity-60 shadow-lg' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="touch-none cursor-grab active:cursor-grabbing shrink-0 rounded p-1 -ml-1"
          {...listeners}
          {...attributes}
          title="Drag to reorder"
        >
          <DragHandleIcon />
        </span>
        <Link
          href={`/project/${project.id}`}
          className="min-w-0 flex-1 font-medium transition hover:underline"
        >
          {project.name}
        </Link>
        <button
          type="button"
          onClick={() => onDelete(project.id)}
          className="shrink-0 text-xs text-[var(--muted)] hover:text-red-400 hover:underline"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
