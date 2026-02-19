'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

interface AudioPlayerProps {
  streamUrlApi: string;
  trackName: string;
  onEnded?: () => void;
  className?: string;
}

export function AudioPlayer({ streamUrlApi, trackName, onEnded, className = '' }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const capturePointerIdRef = useRef<number | null>(null);
  const isScrubbingRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPct, setScrubPct] = useState<number | null>(null);
  isScrubbingRef.current = isScrubbing;

  useEffect(() => {
    setError(null);
    setLoading(true);
  }, [streamUrlApi]);

  const seekFromClientX = useCallback((clientX: number) => {
    const bar = barRef.current;
    const a = audioRef.current;
    if (!bar || !a) return;
    const d = a.duration;
    if (!Number.isFinite(d) || d <= 0) return;
    const rect = bar.getBoundingClientRect();
    const pct = clamp((clientX - rect.left) / rect.width, 0, 1);
    const time = pct * d;
    a.currentTime = time;
    setScrubPct(pct * 100);
    setCurrent(time);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      const d = audio.duration;
      setDuration(Number.isFinite(d) && d >= 0 ? d : 0);
    };
    const onDurationChange = () => {
      const d = audio.duration;
      setDuration(Number.isFinite(d) && d >= 0 ? d : 0);
    };
    const onTimeUpdate = () => {
      if (!isScrubbingRef.current) setCurrent(audio.currentTime || 0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnd = () => {
      setIsPlaying(false);
      setCurrent(audio.duration ?? duration);
      onEnded?.();
    };
    const onError = () => console.log('[AudioPlayer] error', audio.error?.code, audio.error?.message);
    const onStalled = () => console.log('[AudioPlayer] stalled');
    const onWaiting = () => console.log('[AudioPlayer] waiting');
    const onCanPlay = () => console.log('[AudioPlayer] canplay');
    const onCanPlayThrough = () => console.log('[AudioPlayer] canplaythrough');

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnd);
    audio.addEventListener('error', onError);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('canplaythrough', onCanPlayThrough);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnd);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('canplaythrough', onCanPlayThrough);
    };
  }, [onEnded, duration]);

  // requestAnimationFrame loop while playing for smooth bar follow
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isPlaying) {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }
    const tick = () => {
      if (!audioRef.current || audioRef.current.paused) return;
      setCurrent(audioRef.current.currentTime);
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isPlaying]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsScrubbing(true);
    capturePointerIdRef.current = e.pointerId;
    barRef.current?.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX);
  }, [seekFromClientX]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 0) seekFromClientX(e.clientX);
  }, [seekFromClientX]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    setIsScrubbing(false);
    setScrubPct(null);
    if (capturePointerIdRef.current != null) {
      try {
        barRef.current?.releasePointerCapture(capturePointerIdRef.current);
      } catch {
        // ignore
      }
      capturePointerIdRef.current = null;
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !Number.isFinite(duration) || duration <= 0) return;
    const step = e.shiftKey ? 15 : 5;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      a.currentTime = clamp(a.currentTime - step, 0, duration);
      setCurrent(a.currentTime);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      a.currentTime = clamp(a.currentTime + step, 0, duration);
      setCurrent(a.currentTime);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const pct = 0.5;
      a.currentTime = pct * duration;
      setCurrent(a.currentTime);
    }
  }, [duration]);

  const progressPct = clamp(scrubPct ?? (duration > 0 ? (current / duration) * 100 : 0), 0, 100);
  const displayTime = scrubPct != null ? (scrubPct / 100) * duration : current;

  const formatTime = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
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
          Tap play again
        </button>
      </div>
    );
  }

  const audio = audioRef.current;

  return (
    <div className={`rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 ${className}`}>
      {streamUrlApi && (
        <audio
          ref={audioRef}
          src={streamUrlApi}
          preload="metadata"
          playsInline
          onLoadStart={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onLoadedData={() => setLoading(false)}
          onError={async () => {
            setLoading(false);
            const code = audioRef.current?.error?.code;
            let message: string;
            try {
              const res = await fetch(streamUrlApi, { method: 'GET', redirect: 'manual' });
              const headStatus = res.headers.get('X-Stream-Head-Status') ?? '';
              const headType = res.headers.get('X-Stream-Head-Type') ?? '';
              if (headStatus === '404' || headStatus === '400') {
                message = 'File missing. This track\'s DB path doesn\'t match an object in storage (404/400). Try re-uploading the track.';
              } else if ((headStatus === '200' || headStatus === '206') && headType && !/^audio\//i.test(headType)) {
                message = `Stream returned non-audio content-type: ${headType}`;
              } else {
                message = code != null ? `Error ${code}. Tap play again.` : 'Failed to load audio. Tap play again.';
              }
            } catch {
              message = code != null ? `Error ${code}. Tap play again.` : 'Failed to load audio. Tap play again.';
            }
            setError(message);
          }}
        />
      )}
      {loading && <p className="text-sm text-[var(--muted)]">Loading…</p>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (audio?.paused ? audio.play() : audio?.pause())}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--border)] text-[var(--text)] transition hover:bg-[var(--muted)]"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
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
        <div className="min-w-0 flex-1 touch-none">
          <div
            ref={barRef}
            role="progressbar"
            tabIndex={0}
            aria-valuenow={duration > 0 ? current : 0}
            aria-valuemin={0}
            aria-valuemax={duration > 0 ? duration : 0}
            className="relative h-2 cursor-pointer rounded-full bg-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onKeyDown={handleKeyDown}
            title="Click or drag to seek"
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--muted)] pointer-events-none"
              style={{ width: `${progressPct}%` }}
            />
            <div
              className="absolute top-1/2 w-4 h-4 -translate-y-1/2 -translate-x-1/2 rounded-full bg-[var(--text)] shadow pointer-events-none"
              style={{ left: `${progressPct}%` }}
              aria-hidden
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
