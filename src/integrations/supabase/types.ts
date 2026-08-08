export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      mechanic_job_photos: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          job_id: string
          photo_stage: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          job_id: string
          photo_stage: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          job_id?: string
          photo_stage?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mechanic_job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "mechanic_job_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mechanic_job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "mechanic_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanic_job_workers: {
        Row: {
          created_at: string
          job_id: string
          team_member_id: string
          worker_type: string
        }
        Insert: {
          created_at?: string
          job_id: string
          team_member_id: string
          worker_type: string
        }
        Update: {
          created_at?: string
          job_id?: string
          team_member_id?: string
          worker_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "mechanic_job_workers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "mechanic_job_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mechanic_job_workers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "mechanic_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mechanic_job_workers_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "mechanic_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      mechanic_jobs: {
        Row: {
          completed_time: string | null
          created_at: string
          created_by: string | null
          id: string
          job_date: string
          job_no: number
          labour_amount: number
          location: string | null
          notes: string | null
          parts_amount: number
          registration_number: string
          start_time: string | null
          status: string
          updated_at: string
          vehicle_external_id: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          work_description: string
        }
        Insert: {
          completed_time?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_date?: string
          job_no?: never
          labour_amount?: number
          location?: string | null
          notes?: string | null
          parts_amount?: number
          registration_number: string
          start_time?: string | null
          status?: string
          updated_at?: string
          vehicle_external_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          work_description: string
        }
        Update: {
          completed_time?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_date?: string
          job_no?: never
          labour_amount?: number
          location?: string | null
          notes?: string | null
          parts_amount?: number
          registration_number?: string
          start_time?: string | null
          status?: string
          updated_at?: string
          vehicle_external_id?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          work_description?: string
        }
        Relationships: []
      }
      mechanic_team_members: {
        Row: {
          auth_user_id: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      mechanic_job_summary: {
        Row: {
          completed_time: string | null
          created_at: string | null
          helpers: string | null
          id: string | null
          job_date: string | null
          job_no: number | null
          labour_amount: number | null
          labour_hours: number | null
          location: string | null
          mechanics: string | null
          notes: string | null
          parts_amount: number | null
          registration_number: string | null
          start_time: string | null
          status: string | null
          total_amount: number | null
          updated_at: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          work_description: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      bp_public_status: {
        Args: { p_token: string }
        Returns: {
          car_make: string
          car_model: string
          job_ref: string
          plate_number: string
          ready_date: string
          repair_stage: string
          status: string
          updated_at: string
        }[]
      }
      get_secret: { Args: { secret_name: string }; Returns: string }
    }
    Enums: {
      advance_status: "pending" | "approved" | "rejected"
      advance_type: "borrow" | "repayment"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      advance_status: ["pending", "approved", "rejected"],
      advance_type: ["borrow", "repayment"],
    },
  },
} as const
