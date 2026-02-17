# Supabase single source of truth – audit report

## Goal

- UI must show exactly what is in Supabase (DB + storage). If Supabase has 0 tracks, UI shows 0 tracks.
- No ghost tracks from localStorage, mock data, or stale caches.
- All track list data comes from a single server fetch to Supabase.

---

## 1. Audit: non-Supabase sources of track data

| Source | Result |
|--------|--------|
| **localStorage / sessionStorage** | None found. No keys like `tracks`, `musicclub`, `projectTracks`. |
| **indexedDB** | None found. |
| **Service worker / PWA caches** | None. No `sw.js` or `manifest.json` in the repo. |
| **Mock / seeded / demo data** | None. No `initialTracks`, mock arrays, or seed data. |
| **React Query / SWR** | None. No `useSWR`, `useQuery`, or `@tanstack/react-query`. |
| **Next.js static / cached data** | Tracks are not from a server component or `getStaticProps`. Project page is `'use client'` and fetches via `fetch()` in `useEffect`. |

**Conclusion:** The only place `tracks` state is set is:

- `setTracks(list)` when `GET /api/projects/[id]/tracks` returns OK (list = API response).
- `setTracks([])` when that request fails or when “Hard Refresh” runs (before refetch).

So **ghost tracks could only appear if the API response itself contained old data** (e.g. browser or CDN caching the API response, or the app pointing at a different Supabase project). The app code does not persist or seed tracks anywhere.

---

## 2. Single source of truth – what was done

### Server route: `GET /api/projects/[projectId]/tracks`

- **File:** `app/api/projects/[id]/tracks/route.ts`
- **Behavior:** Queries Supabase: `select * from tracks where project_id = projectId order by created_at desc`. Returns JSON array only. No static/cache.
- **Headers added/confirmed:**
  - `Cache-Control: no-store, no-cache, max-age=0, must-revalidate`
  - `Pragma: no-cache`
  - `Expires: 0`
- **Next.js:** `export const dynamic = 'force-dynamic'` and `export const runtime = 'nodejs'` so the route is never statically cached.

### Client: project page

- **File:** `app/project/[id]/page.tsx`
- **On load:** `loadFromBackend()` runs (in `useEffect` when `id` or `loadFromBackend` changes). It sets `tracks` to `[]`, then calls `fetchProject()` and `fetchTracks()`. `fetchTracks()` uses `fetch('/api/projects/${id}/tracks?t=${Date.now()}', { cache: 'no-store' })` and sets `tracks` to the response array (or `[]` on error).
- **Rendering:** The list is rendered only from `tracks` (the state filled by that fetch). No local arrays or fallbacks.
- **After add/delete/upload:** Each action calls `fetchTracks()` (or equivalent) after success, so the list is re-fetched from Supabase and re-rendered.

### “Hard Refresh from Supabase” button

- Replaces the previous “Refresh from backend” label.
- **Action:** Clears in-memory state (`setTracks([])`, `setError(null)`), sets loading, then runs `fetchProject()` and `fetchTracks()`. No localStorage/indexedDB to clear (none used).
- **Location:** Next to the project title and in the error-state view.

### Debug endpoints (proof of truth)

- **GET /api/debug/tracks?projectId=...**  
  Returns raw DB rows for that project from Supabase.  
  Headers: `Cache-Control: no-store, no-cache, max-age=0, must-revalidate`, `Pragma: no-cache`.

- **GET /api/debug/storage?projectId=...**  
  Lists storage objects under `projectId/` in the `music-files` bucket.  
  Same no-store headers.

---

## 3. Code removed or changed

- **No code was removed** as the audit found no localStorage, mock data, or SWR/React Query.
- **Changes made:**
  - **`app/api/projects/[id]/tracks/route.ts`:** Comment that this route is the single source of truth; added `Expires: 0` to the response headers.
  - **`app/project/[id]/page.tsx`:** Comment that tracks come only from the API (Supabase); renamed refresh button to “Hard Refresh from Supabase”; ensured `loadFromBackend` clears `tracks` first then refetches; added `data-source="supabase"` and `data-track-count` on the list for verification.
  - **`app/api/debug/tracks/route.ts`** and **`app/api/debug/storage/route.ts`:** Stronger no-store cache headers for consistency.

---

## 4. Verification steps

1. **Confirm Supabase is empty**  
   In Supabase: `tracks` table has 0 rows for the project; Storage has 0 objects under that project’s folder.

2. **Clear site data**  
   In Chrome: DevTools → Application → Storage → “Clear site data” (or clear only this origin). Reload the app.

3. **Open the project page**  
   You should see “No tracks” (or the empty state). No ghost tracks.

4. **Check debug endpoints**  
   - `GET /api/debug/tracks?projectId=<uuid>` → `{ "projectId": "...", "tracks": [] }`.
   - `GET /api/debug/storage?projectId=<uuid>` → `{ "projectId": "...", "objects": [] }`.

5. **Hard Refresh**  
   Click “Hard Refresh from Supabase”. List should stay empty (no new requests that could bring back ghosts; only the same API, no cache).

6. **Add a track**  
   Upload a file (or add via your flow). Then:
   - `GET /api/debug/tracks?projectId=...` should show one row.
   - UI should show one track after load or after “Hard Refresh from Supabase”.

If the UI still shows ghost tracks after a full reload and “Hard Refresh”, then the response of `GET /api/projects/[id]/tracks` is still coming from somewhere cached (e.g. browser, proxy, or a different Supabase project). In that case, compare that response with `GET /api/debug/tracks?projectId=...` and the Supabase dashboard to see which is the actual source of the discrepancy.
