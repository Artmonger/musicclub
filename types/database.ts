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
      projects: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
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
          name: string;
          storage_path: string;
          file_type: 'mp3' | 'wav' | 'm4a';
          bpm: number | null;
          key: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          storage_path: string;
          file_type: 'mp3' | 'wav' | 'm4a';
          bpm?: number | null;
          key?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          storage_path?: string;
          file_type?: 'mp3' | 'wav' | 'm4a';
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

export type Project = Database['public']['Tables']['projects']['Row'];
export type Track = Database['public']['Tables']['tracks']['Row'];
export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type TrackInsert = Database['public']['Tables']['tracks']['Insert'];
