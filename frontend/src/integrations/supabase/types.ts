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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          http_status: number | null
          id: number
          ip_addr: unknown
          ixc_endpoint: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          http_status?: number | null
          id?: number
          ip_addr?: unknown
          ixc_endpoint: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          http_status?: number | null
          id?: number
          ip_addr?: unknown
          ixc_endpoint?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_events: {
        Row: {
          contract_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          event_source: string
          event_type: string
          id: string
          idempotency_key: string
          ixc_connection_id: string | null
          occurred_at: string
          payload: Json
          points: number
          source_reference_id: string | null
          source_reference_type: string | null
          tenant_id: string
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          event_source: string
          event_type: string
          id?: string
          idempotency_key: string
          ixc_connection_id?: string | null
          occurred_at?: string
          payload?: Json
          points: number
          source_reference_id?: string | null
          source_reference_type?: string | null
          tenant_id: string
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          event_source?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          ixc_connection_id?: string | null
          occurred_at?: string
          payload?: Json
          points?: number
          source_reference_id?: string | null
          source_reference_type?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_ixc_connection_id_fkey"
            columns: ["ixc_connection_id"]
            isOneToOne: false
            referencedRelation: "ixc_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ixc_connections: {
        Row: {
          active: boolean
          created_at: string
          id: string
          ixc_base_url: string
          ixc_token_enc: string
          ixc_token_iv: string
          ixc_user: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          ixc_base_url: string
          ixc_token_enc: string
          ixc_token_iv: string
          ixc_user: string
          name?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          ixc_base_url?: string
          ixc_token_enc?: string
          ixc_token_iv?: string
          ixc_user?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ixc_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          idempotency_key: string
          ixc_connection_id: string | null
          payload: Json
          points_spent: number
          reward_code: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          idempotency_key: string
          ixc_connection_id?: string | null
          payload?: Json
          points_spent: number
          reward_code: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          idempotency_key?: string
          ixc_connection_id?: string | null
          payload?: Json
          points_spent?: number
          reward_code?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_ixc_connection_id_fkey"
            columns: ["ixc_connection_id"]
            isOneToOne: false
            referencedRelation: "ixc_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          active: boolean
          created_at: string
          id: string
          ixc_base_url: string | null
          ixc_token_enc: string | null
          ixc_token_iv: string | null
          ixc_user: string | null
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          ixc_base_url?: string | null
          ixc_token_enc?: string | null
          ixc_token_iv?: string | null
          ixc_user?: string | null
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          ixc_base_url?: string | null
          ixc_token_enc?: string | null
          ixc_token_iv?: string | null
          ixc_user?: string | null
          name?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
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
