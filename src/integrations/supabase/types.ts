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
      dhx_dodge_scores: {
        Row: {
          best_combo: number
          coins: number
          created_at: string
          distance: number
          id: number
          level: number
          player_name: string
          score: number
        }
        Insert: {
          best_combo?: number
          coins?: number
          created_at?: string
          distance?: number
          id?: number
          level?: number
          player_name: string
          score?: number
        }
        Update: {
          best_combo?: number
          coins?: number
          created_at?: string
          distance?: number
          id?: number
          level?: number
          player_name?: string
          score?: number
        }
        Relationships: []
      }
      drivers: {
        Row: {
          bank_account: string | null
          bank_name: string | null
          created_at: string | null
          deposit_amount: number | null
          deposit_paid_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          grab_id: string | null
          ic_back_url: string | null
          ic_front_url: string | null
          ic_number: string | null
          ic_photo_url: string | null
          id: string
          license_expiry: string | null
          license_front_url: string | null
          license_number: string | null
          license_photo_url: string | null
          notes: string | null
          profile_id: string | null
          selfie_url: string | null
          status: string | null
          updated_at: string | null
          verification_notes: string | null
          verification_status: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          bank_account?: string | null
          bank_name?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          grab_id?: string | null
          ic_back_url?: string | null
          ic_front_url?: string | null
          ic_number?: string | null
          ic_photo_url?: string | null
          id?: string
          license_expiry?: string | null
          license_front_url?: string | null
          license_number?: string | null
          license_photo_url?: string | null
          notes?: string | null
          profile_id?: string | null
          selfie_url?: string | null
          status?: string | null
          updated_at?: string | null
          verification_notes?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          bank_account?: string | null
          bank_name?: string | null
          created_at?: string | null
          deposit_amount?: number | null
          deposit_paid_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          grab_id?: string | null
          ic_back_url?: string | null
          ic_front_url?: string | null
          ic_number?: string | null
          ic_photo_url?: string | null
          id?: string
          license_expiry?: string | null
          license_front_url?: string | null
          license_number?: string | null
          license_photo_url?: string | null
          notes?: string | null
          profile_id?: string | null
          selfie_url?: string | null
          status?: string | null
          updated_at?: string | null
          verification_notes?: string | null
          verification_status?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mc_parkour_scores: {
        Row: {
          coins: number
          created_at: string
          distance: number
          id: number
          player_name: string
          score: number
        }
        Insert: {
          coins?: number
          created_at?: string
          distance?: number
          id?: number
          player_name: string
          score?: number
        }
        Update: {
          coins?: number
          created_at?: string
          distance?: number
          id?: number
          player_name?: string
          score?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          driver_id: string
          due_date: string | null
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
          receipt_url: string | null
          recorded_by: string | null
          reference_number: string | null
          rental_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          driver_id: string
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          reference_number?: string | null
          rental_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          driver_id?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          reference_number?: string | null
          rental_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rentals: {
        Row: {
          agreement_signed_at: string | null
          created_at: string | null
          driver_id: string
          end_date: string | null
          end_mileage: number | null
          id: string
          pickup_notes: string | null
          pickup_photo_url: string | null
          rate: number
          rental_type: string | null
          return_notes: string | null
          return_photo_url: string | null
          start_date: string
          start_mileage: number | null
          status: string | null
          terminated_reason: string | null
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          agreement_signed_at?: string | null
          created_at?: string | null
          driver_id: string
          end_date?: string | null
          end_mileage?: number | null
          id?: string
          pickup_notes?: string | null
          pickup_photo_url?: string | null
          rate: number
          rental_type?: string | null
          return_notes?: string | null
          return_photo_url?: string | null
          start_date: string
          start_mileage?: number | null
          status?: string | null
          terminated_reason?: string | null
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          agreement_signed_at?: string | null
          created_at?: string | null
          driver_id?: string
          end_date?: string | null
          end_mileage?: number | null
          id?: string
          pickup_notes?: string | null
          pickup_photo_url?: string | null
          rate?: number
          rental_type?: string | null
          return_notes?: string | null
          return_photo_url?: string | null
          start_date?: string
          start_mileage?: number | null
          status?: string | null
          terminated_reason?: string | null
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          color: string | null
          created_at: string | null
          daily_rate: number | null
          id: string
          insurance_expiry: string | null
          make: string
          mileage: number | null
          model: string
          monthly_rate: number | null
          notes: string | null
          photo_url: string | null
          plate_number: string
          puspakom_expiry: string | null
          road_tax_expiry: string | null
          status: string | null
          updated_at: string | null
          weekly_rate: number | null
          year: number
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          daily_rate?: number | null
          id?: string
          insurance_expiry?: string | null
          make: string
          mileage?: number | null
          model: string
          monthly_rate?: number | null
          notes?: string | null
          photo_url?: string | null
          plate_number: string
          puspakom_expiry?: string | null
          road_tax_expiry?: string | null
          status?: string | null
          updated_at?: string | null
          weekly_rate?: number | null
          year: number
        }
        Update: {
          color?: string | null
          created_at?: string | null
          daily_rate?: number | null
          id?: string
          insurance_expiry?: string | null
          make?: string
          mileage?: number | null
          model?: string
          monthly_rate?: number | null
          notes?: string | null
          photo_url?: string | null
          plate_number?: string
          puspakom_expiry?: string | null
          road_tax_expiry?: string | null
          status?: string | null
          updated_at?: string | null
          weekly_rate?: number | null
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      dhx_dodge_top100: {
        Row: {
          best_combo: number | null
          coins: number | null
          created_at: string | null
          distance: number | null
          level: number | null
          player_name: string | null
          rank: number | null
          score: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
