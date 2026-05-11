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
      activities: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_assignments: {
        Row: {
          activity_id: string
          assigned_at: string
          assigned_by: string | null
          child_id: string
          completed_at: string | null
          completed_by: string | null
          date: string
          id: string
          organization_id: string
          status: Database["public"]["Enums"]["activity_assignment_status"]
        }
        Insert: {
          activity_id: string
          assigned_at?: string
          assigned_by?: string | null
          child_id: string
          completed_at?: string | null
          completed_by?: string | null
          date: string
          id?: string
          organization_id: string
          status?: Database["public"]["Enums"]["activity_assignment_status"]
        }
        Update: {
          activity_id?: string
          assigned_at?: string
          assigned_by?: string | null
          child_id?: string
          completed_at?: string | null
          completed_by?: string | null
          date?: string
          id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["activity_assignment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "activity_assignments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_assignments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          checked_in_at: string | null
          checked_out_at: string | null
          child_id: string
          created_at: string
          daily_note: string | null
          date: string
          id: string
          leave_notified: boolean
          leave_time: string | null
          leave_time_unspecified: boolean
          organization_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          child_id: string
          created_at?: string
          daily_note?: string | null
          date: string
          id?: string
          leave_notified?: boolean
          leave_time?: string | null
          leave_time_unspecified?: boolean
          organization_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          checked_in_at?: string | null
          checked_out_at?: string | null
          child_id?: string
          created_at?: string
          daily_note?: string | null
          date?: string
          id?: string
          leave_notified?: boolean
          leave_time?: string | null
          leave_time_unspecified?: boolean
          organization_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          address: string | null
          allergies: string | null
          can_leave_alone: boolean
          category_id: string | null
          cpr_number: string | null
          created_at: string
          default_leave_time: string | null
          doctor_name: string | null
          doctor_phone: string | null
          first_name: string | null
          full_name: string
          id: string
          last_name: string | null
          organization_id: string
          parent_1_name: string | null
          parent_1_phone: string | null
          parent_2_name: string | null
          parent_2_phone: string | null
          photo_url: string | null
          special_notes: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          can_leave_alone?: boolean
          category_id?: string | null
          cpr_number?: string | null
          created_at?: string
          default_leave_time?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          first_name?: string | null
          full_name: string
          id?: string
          last_name?: string | null
          organization_id: string
          parent_1_name?: string | null
          parent_1_phone?: string | null
          parent_2_name?: string | null
          parent_2_phone?: string | null
          photo_url?: string | null
          special_notes?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          allergies?: string | null
          can_leave_alone?: boolean
          category_id?: string | null
          cpr_number?: string | null
          created_at?: string
          default_leave_time?: string | null
          doctor_name?: string | null
          doctor_phone?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          last_name?: string | null
          organization_id?: string
          parent_1_name?: string | null
          parent_1_phone?: string | null
          parent_2_name?: string | null
          parent_2_phone?: string | null
          photo_url?: string | null
          special_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          activities_snapshot: Json | null
          attendance_snapshot: Json | null
          closed_at: string
          closed_by: string | null
          created_at: string
          date: string
          employee_time_snapshot: Json | null
          id: string
          organization_id: string
          total_children_present: number
        }
        Insert: {
          activities_snapshot?: Json | null
          attendance_snapshot?: Json | null
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          date: string
          employee_time_snapshot?: Json | null
          id?: string
          organization_id: string
          total_children_present?: number
        }
        Update: {
          activities_snapshot?: Json | null
          attendance_snapshot?: Json | null
          closed_at?: string
          closed_by?: string | null
          created_at?: string
          date?: string
          employee_time_snapshot?: Json | null
          id?: string
          organization_id?: string
          total_children_present?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      day_status: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          date: string
          id: string
          is_closed: boolean
          organization_id: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          date: string
          id?: string
          is_closed?: boolean
          organization_id: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          date?: string
          id?: string
          is_closed?: boolean
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_status_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_time_logs: {
        Row: {
          break_started_at: string | null
          created_at: string
          date: string
          id: string
          organization_id: string
          shift_ended_at: string | null
          shift_started_at: string | null
          status: Database["public"]["Enums"]["shift_status"]
          total_break_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          break_started_at?: string | null
          created_at?: string
          date: string
          id?: string
          organization_id: string
          shift_ended_at?: string | null
          shift_started_at?: string | null
          status?: Database["public"]["Enums"]["shift_status"]
          total_break_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          break_started_at?: string | null
          created_at?: string
          date?: string
          id?: string
          organization_id?: string
          shift_ended_at?: string | null
          shift_started_at?: string | null
          status?: Database["public"]["Enums"]["shift_status"]
          total_break_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_time_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      backup_codes: {
        Row: {
          id: string
          user_id: string
          code_hash: string
          used: boolean
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          code_hash: string
          used?: boolean
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          code_hash?: string
          used?: boolean
          used_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_tier: 'gratis' | 'basis' | 'pro' | 'organisation'
          subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing'
          require_2fa: boolean
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_tier?: 'gratis' | 'basis' | 'pro' | 'organisation'
          subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing'
          require_2fa?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_tier?: 'gratis' | 'basis' | 'pro' | 'organisation'
          subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing'
          require_2fa?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_day_closed: {
        Args: { _date: string; _org_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      redeem_invite: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      activity_assignment_status: "active" | "completed"
      app_role: "admin" | "employee"
      attendance_status: "present" | "absent" | "picked_up"
      member_status: "active" | "pending"
      shift_status: "not_started" | "working" | "on_break" | "finished"
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
      activity_assignment_status: ["active", "completed"],
      app_role: ["admin", "employee"],
      attendance_status: ["present", "absent", "picked_up"],
      member_status: ["active", "pending"],
      shift_status: ["not_started", "working", "on_break", "finished"],
    },
  },
} as const
