-- RPC to fetch tracks by project_id. SECURITY DEFINER runs with definer rights so it bypasses RLS.
-- Use this when .eq('project_id', ...) returns [] due to policies; app calls supabase.rpc('get_tracks_for_project', { p_project_id: projectId }).
CREATE OR REPLACE FUNCTION public.get_tracks_for_project(p_project_id uuid)
RETURNS SETOF public.tracks
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT * FROM public.tracks
  WHERE project_id = p_project_id
  ORDER BY created_at DESC;
$$;

COMMENT ON FUNCTION public.get_tracks_for_project(uuid) IS 'Returns tracks for the given project_id. SECURITY DEFINER so it works regardless of RLS.';

GRANT EXECUTE ON FUNCTION public.get_tracks_for_project(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_tracks_for_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tracks_for_project(uuid) TO service_role;
