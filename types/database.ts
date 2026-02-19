export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      artists: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          artist_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          artist_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          artist_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      tracks: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          file_path: string | null;
          bpm: number | null;
          key: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          file_path?: string | null;
          bpm?: number | null;
          key?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string;
          file_path?: string;
          bpm?: number | null;
          key?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export type Artist = Database['public']['Tables']['artists']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type Track = Database['public']['Tables']['tracks']['Row'];
export type ArtistInsert = Database['public']['Tables']['artists']['Insert'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type TrackInsert = Database['public']['Tables']['tracks']['Insert'];
