'use client';

import { useRef, useState, useEffect } from 'react';

interface AudioPlayerProps {
  /** Only URL the browser should request: /api/stream?path=<storagePath>. Server redirects to signed Supabase URL. */
  streamUrlApi: string;
  trackName: string;
  onEnded?: () => void;
  className?: string;
}

export function AudioPlayer({ streamUrlApi, trackName, onEnded, className = '' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setError(null);
    setLoading(true);
  }, [streamUrlApi]);

  const audio = audioRef.current;

  useEffect(() => {
    if (!audio) return;
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnd = () => {
      setPlaying(false);
      onEnded?.();
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnd);
    };
  }, [audio, onEnded]);

  const formatTime = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    audio.currentTime = x * duration;
  };

  if (error) {
    return (
      <div className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 ${className}`}>
        <p className="text-sm text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => { setError(null); setLoading(true); }}
          className="mt-2 text-sm text-[var(--accent)] hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 ${className}`}>
      {streamUrlApi && (
        <audio
          ref={audioRef}
          src={streamUrlApi}
          preload="metadata"
          onLoadStart={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onLoadedData={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('Failed to load audio');
          }}
        />
      )}
      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      <p className="mb-2 truncate text-sm font-medium">{trackName}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (audio?.paused ? audio.play() : audio?.pause())}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--border)] text-[var(--text)] transition hover:bg-[var(--muted)]"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div
            role="progressbar"
            tabIndex={0}
            className="h-1.5 cursor-pointer rounded-full bg-[var(--border)]"
            onClick={seek}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                seek(e as unknown as React.MouseEvent<HTMLDivElement>);
              }
            }}
          >
            <div
              className="h-full rounded-full bg-[var(--muted)] transition-all"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
