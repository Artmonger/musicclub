# Music Project App

Private single-user music project management: projects, audio uploads (mp3, wav, m4a), BPM/key/notes, and streaming. No auth—all access is server-side only with the Supabase service role.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Supabase** (Postgres + Storage)

## Security

- No authentication or sign-up; single user only.
- **Supabase service role key** is used only in Next.js server code (API routes). It is never sent to the client.
- Use **SUPABASE_URL** and **SUPABASE_SECRET_KEY** (server-only). All data and storage access goes through your API; the client never talks to Supabase directly.

## Setup

1. **Supabase**
   - Create a project at [supabase.com](https://supabase.com).
   - In the SQL Editor, run `supabase/schema.sql`.
   - In Storage, create a **private** bucket named `Music Files` (no public access).

2. **Env**
   - Copy `.env.local.example` to `.env.local`.
   - Set `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (from Supabase → Settings → API; use the **Project URL** and **service_role** secret).

3. **Run**
   - `npm install`
   - `npm run dev` → [http://localhost:3000](http://localhost:3000)

## Deploy (Vercel)

1. Push the repo and import the project in Vercel.
2. Add env vars: `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (same names as in Vercel Environment Variables).
3. Deploy.

**Live app:** https://musicclub-rr8x.vercel.app

Note: Vercel serverless request body limit is 4.5 MB (Hobby) or 5 MB (Pro). For larger uploads, use Supabase client upload with signed upload URLs issued by your API, or another upload path.

**If GET /api/projects/[id]/tracks returns [] but Supabase has rows:** (1) Run `supabase/migrations/20250217000000_disable_rls_projects_tracks.sql` to disable RLS. (2) Run `supabase/migrations/20250217100000_get_tracks_for_project_rpc.sql` to create the `get_tracks_for_project` RPC (SECURITY DEFINER) used by the tracks API.

## API (all server-side; call from your app only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project (`name`, optional `description`) |
| GET | `/api/projects/[id]` | Get project |
| PATCH | `/api/projects/[id]` | Update project |
| DELETE | `/api/projects/[id]` | Delete project |
| GET | `/api/projects/[id]/tracks` | List tracks |
| POST | `/api/upload` | Upload audio (form: `file`, `projectId`, optional `name`) |
| PATCH | `/api/tracks` | Update track (`id`, optional `bpm`, `key`, `notes`, `name`) |
| DELETE | `/api/tracks?id=...` | Delete track |
| GET | `/api/stream?path=...` | Get signed URL for streaming (path = storage path) |
