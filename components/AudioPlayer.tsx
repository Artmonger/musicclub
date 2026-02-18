'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

interface AudioPlayerProps {
  /** Only URL the browser should request: /api/stream?path=<storagePath>. Server redirects to signed Supabase URL. */
  streamUrlApi: string;
  trackName: string;
  onEnded?: () => void;
  className?: string;
}

export function AudioPlayer({ streamUrlApi, trackName, onEnded, className = '' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPct, setScrubPct] = useState(0);

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

  const seekFromEvent = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const bar = barRef.current;
    const a = audioRef.current;
    if (!bar || !a) return;
    const d = a.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    const rect = bar.getBoundingClientRect();
    const pct = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    a.currentTime = pct * d;
    setScrubPct(pct * 100);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    seekFromEvent(e);
    barRef.current?.setPointerCapture(e.pointerId);
  }, [seekFromEvent]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 0) seekFromEvent(e);
  }, [seekFromEvent]);

  const handlePointerUp = useCallback(() => {
    setIsScrubbing(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !Number.isFinite(duration) || duration <= 0) return;
    const step = e.shiftKey ? 15 : 5;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      a.currentTime = clamp(a.currentTime - step, 0, duration);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      a.currentTime = clamp(a.currentTime + step, 0, duration);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (barRef.current) {
        const rect = barRef.current.getBoundingClientRect();
        const pct = 0.5;
        a.currentTime = pct * duration;
      }
    }
  }, [duration]);

  const progressPct = isScrubbing ? scrubPct : (duration > 0 ? (currentTime / duration) * 100 : 0);
  const displayTime = isScrubbing ? (scrubPct / 100) * duration : currentTime;

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
            ref={barRef}
            role="progressbar"
            tabIndex={0}
            aria-valuenow={duration > 0 ? currentTime : 0}
            aria-valuemin={0}
            aria-valuemax={duration > 0 ? duration : 0}
            className="h-2 cursor-pointer rounded-full bg-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
            title="Click or drag to seek"
          >
            <div
              className="h-full rounded-full bg-[var(--muted)] transition-all pointer-events-none"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
            <span>{formatTime(displayTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
