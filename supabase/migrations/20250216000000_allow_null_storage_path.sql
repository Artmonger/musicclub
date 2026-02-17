-- Allow tracks without a file (manual "Add track" in UI)
-- Run in Supabase SQL Editor if your tracks table has storage_path NOT NULL

ALTER TABLE tracks ALTER COLUMN storage_path DROP NOT NULL;
