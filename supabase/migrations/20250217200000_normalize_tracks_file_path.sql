-- One-time cleanup: normalize tracks.file_path to object path only (projectId/filename).
-- Run in Supabase SQL Editor. file_path must NOT be a full URL and must NOT include music-files/ prefix.
-- /api/stream expects path like: <projectId>/<filename>

-- 1) Strip leading "music-files/" or "music-files" prefix
UPDATE public.tracks
SET file_path = trim(both '/' from regexp_replace(file_path, '^music-files/?', '', 'i'))
WHERE file_path IS NOT NULL
  AND file_path ~* '^music-files';

-- 2) If file_path is a full URL or contains /storage/v1/, extract object path (part after /music-files/)
UPDATE public.tracks
SET file_path = (regexp_matches(file_path, '/music-files/([^?#]+)'))[1]
WHERE file_path IS NOT NULL
  AND (file_path LIKE 'http://%' OR file_path LIKE 'https://%' OR file_path LIKE '%/storage/v1/%')
  AND file_path ~ '/music-files/[^?#]+';
