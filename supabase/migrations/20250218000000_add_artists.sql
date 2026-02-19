-- Add artists as top-level entity. Projects belong to exactly one artist.
-- Existing projects are assigned to "Default Artist".

-- 1) Create artists table
CREATE TABLE IF NOT EXISTS public.artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artists_created_at ON public.artists(created_at DESC);

-- 2) Create Default Artist for existing projects
INSERT INTO public.artists (id, name)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'Default Artist')
ON CONFLICT (id) DO NOTHING;

-- 3) Add artist_id to projects (nullable first for backfill)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES public.artists(id) ON DELETE CASCADE;

-- 4) Assign existing projects to Default Artist
UPDATE public.projects
SET artist_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE artist_id IS NULL;

-- 5) Make artist_id NOT NULL
ALTER TABLE public.projects ALTER COLUMN artist_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_artist_id ON public.projects(artist_id);

ALTER TABLE public.artists DISABLE ROW LEVEL SECURITY;
