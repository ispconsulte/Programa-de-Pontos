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
      pontuacao_campanha_clientes: {
        Row: {
          created_at: string
          data_entrada_campanha: string
          email_cliente: string | null
          fidelidade_fim_anterior: string | null
          id: string
          ixc_cliente_id: string
          nome_cliente: string | null
          pontos_acumulados: number
          pontos_disponiveis: number | null
          pontos_resgatados: number
          status_campanha: string
          telefone_cliente: string | null
          ultimo_plano_id: string | null
          ultimo_resgate: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_entrada_campanha?: string
          email_cliente?: string | null
          fidelidade_fim_anterior?: string | null
          id?: string
          ixc_cliente_id: string
          nome_cliente?: string | null
          pontos_acumulados?: number
          pontos_disponiveis?: number | null
          pontos_resgatados?: number
          status_campanha?: string
          telefone_cliente?: string | null
          ultimo_plano_id?: string | null
          ultimo_resgate?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_entrada_campanha?: string
          email_cliente?: string | null
          fidelidade_fim_anterior?: string | null
          id?: string
          ixc_cliente_id?: string
          nome_cliente?: string | null
          pontos_acumulados?: number
          pontos_disponiveis?: number | null
          pontos_resgatados?: number
          status_campanha?: string
          telefone_cliente?: string | null
          ultimo_plano_id?: string | null
          ultimo_resgate?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pontuacao_catalogo_brindes: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          estoque: number | null
          id: string
          imagem_url: string | null
          nome: string
          pontos_necessarios: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          estoque?: number | null
          id?: string
          imagem_url?: string | null
          nome: string
          pontos_necessarios: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          estoque?: number | null
          id?: string
          imagem_url?: string | null
          nome?: string
          pontos_necessarios?: number
          updated_at?: string
        }
        Relationships: []
      }
      pontuacao_faturas_processadas: {
        Row: {
          data_processada: string
          ixc_cliente_id: string | null
          ixc_fatura_id: string
          pontos_atribuidos: number
        }
        Insert: {
          data_processada?: string
          ixc_cliente_id?: string | null
          ixc_fatura_id: string
          pontos_atribuidos: number
        }
        Update: {
          data_processada?: string
          ixc_cliente_id?: string | null
          ixc_fatura_id?: string
          pontos_atribuidos?: number
        }
        Relationships: []
      }
      pontuacao_historico: {
        Row: {
          created_at: string
          criado_por: string
          descricao: string | null
          id: string
          ixc_cliente_id: string
          ixc_fatura_id: string | null
          pontos: number
          referencia_ano: number | null
          referencia_mes: number | null
          tipo_evento: string
        }
        Insert: {
          created_at?: string
          criado_por?: string
          descricao?: string | null
          id?: string
          ixc_cliente_id: string
          ixc_fatura_id?: string | null
          pontos: number
          referencia_ano?: number | null
          referencia_mes?: number | null
          tipo_evento: string
        }
        Update: {
          created_at?: string
          criado_por?: string
          descricao?: string | null
          id?: string
          ixc_cliente_id?: string
          ixc_fatura_id?: string | null
          pontos?: number
          referencia_ano?: number | null
          referencia_mes?: number | null
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontuacao_historico_ixc_cliente_id_fkey"
            columns: ["ixc_cliente_id"]
            isOneToOne: false
            referencedRelation: "pontuacao_campanha_clientes"
            referencedColumns: ["ixc_cliente_id"]
          },
        ]
      }
      pontuacao_resgates: {
        Row: {
          brinde_id: string | null
          brinde_nome: string
          confirmacao_cliente: boolean
          created_at: string
          data_entrega: string | null
          id: string
          ixc_cliente_id: string
          observacoes: string | null
          pontos_utilizados: number
          responsavel_entrega: string | null
          status_resgate: string
          updated_at: string
        }
        Insert: {
          brinde_id?: string | null
          brinde_nome: string
          confirmacao_cliente?: boolean
          created_at?: string
          data_entrega?: string | null
          id?: string
          ixc_cliente_id: string
          observacoes?: string | null
          pontos_utilizados: number
          responsavel_entrega?: string | null
          status_resgate?: string
          updated_at?: string
        }
        Update: {
          brinde_id?: string | null
          brinde_nome?: string
          confirmacao_cliente?: boolean
          created_at?: string
          data_entrega?: string | null
          id?: string
          ixc_cliente_id?: string
          observacoes?: string | null
          pontos_utilizados?: number
          responsavel_entrega?: string | null
          status_resgate?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontuacao_resgates_brinde_id_fkey"
            columns: ["brinde_id"]
            isOneToOne: false
            referencedRelation: "pontuacao_catalogo_brindes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontuacao_resgates_ixc_cliente_id_fkey"
            columns: ["ixc_cliente_id"]
            isOneToOne: false
            referencedRelation: "pontuacao_campanha_clientes"
            referencedColumns: ["ixc_cliente_id"]
          },
        ]
      }
      pontuacao_sync_log: {
        Row: {
          erro_detalhes: string | null
          id: string
          pontos_atribuidos: number
          registros_processados: number
          status: string | null
          sync_at: string
          tipo: string | null
        }
        Insert: {
          erro_detalhes?: string | null
          id?: string
          pontos_atribuidos?: number
          registros_processados?: number
          status?: string | null
          sync_at?: string
          tipo?: string | null
        }
        Update: {
          erro_detalhes?: string | null
          id?: string
          pontos_atribuidos?: number
          registros_processados?: number
          status?: string | null
          sync_at?: string
          tipo?: string | null
        }
        Relationships: []
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
          password_hash: string
          role: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          password_hash: string
          role?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          password_hash?: string
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
