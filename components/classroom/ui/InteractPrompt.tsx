'use client';

interface InteractPromptProps {
  name: string;
  visible: boolean;
}

export function InteractPrompt({ name, visible }: InteractPromptProps) {
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute bottom-1/4 left-1/2 -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm shadow-lg">
      Talk to {name} <span className="text-[var(--muted)]">(E)</span>
    </div>
  );
}
