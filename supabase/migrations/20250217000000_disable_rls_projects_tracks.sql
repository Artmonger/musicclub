-- No-auth private app: ensure service role can read/write all rows.
-- Run this in Supabase SQL Editor if GET /api/projects/[id]/tracks returns [] while tracks exist.
-- Option A: Disable RLS (simplest for single-user, server-only app)
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks DISABLE ROW LEVEL SECURITY;

-- Option B (alternative): Keep RLS enabled but allow all for anon/service_role:
-- ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "allow_all_projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
-- ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "allow_all_tracks" ON public.tracks FOR ALL USING (true) WITH CHECK (true);
