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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      pontuacao_campanha_clientes: {
        Row: {
          auth_user_id: string | null
          created_at: string
          data_entrada_campanha: string
          documento: string | null
          email: string | null
          email_cliente: string | null
          fidelidade_fim_anterior: string | null
          id: string
          ixc_cliente_id: string
          ixc_contrato_id: string | null
          metadata: Json
          nome_cliente: string | null
          pontos_acumulados: number
          pontos_disponiveis: number | null
          pontos_resgatados: number
          status: string
          status_campanha: string
          telefone: string | null
          telefone_cliente: string | null
          tenant_id: string | null
          ultima_sincronizacao_em: string | null
          ultimo_plano_id: string | null
          ultimo_resgate: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          data_entrada_campanha?: string
          documento?: string | null
          email?: string | null
          email_cliente?: string | null
          fidelidade_fim_anterior?: string | null
          id?: string
          ixc_cliente_id: string
          ixc_contrato_id?: string | null
          metadata?: Json
          nome_cliente?: string | null
          pontos_acumulados?: number
          pontos_disponiveis?: number | null
          pontos_resgatados?: number
          status?: string
          status_campanha?: string
          telefone?: string | null
          telefone_cliente?: string | null
          tenant_id?: string | null
          ultima_sincronizacao_em?: string | null
          ultimo_plano_id?: string | null
          ultimo_resgate?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          data_entrada_campanha?: string
          documento?: string | null
          email?: string | null
          email_cliente?: string | null
          fidelidade_fim_anterior?: string | null
          id?: string
          ixc_cliente_id?: string
          ixc_contrato_id?: string | null
          metadata?: Json
          nome_cliente?: string | null
          pontos_acumulados?: number
          pontos_disponiveis?: number | null
          pontos_resgatados?: number
          status?: string
          status_campanha?: string
          telefone?: string | null
          telefone_cliente?: string | null
          tenant_id?: string | null
          ultima_sincronizacao_em?: string | null
          ultimo_plano_id?: string | null
          ultimo_resgate?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontuacao_campanha_clientes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          campanha_cliente_id: string | null
          competencia: string | null
          created_at: string
          data_pagamento: string | null
          data_processada: string
          fatura_id: string | null
          hash_processamento: string | null
          id: string | null
          ixc_cliente_id: string | null
          ixc_contrato_id: string | null
          ixc_fatura_id: string
          payload: Json
          pontos_atribuidos: number
          pontos_gerados: number
          status_processamento: string
          sync_log_id: string | null
          tenant_id: string | null
          updated_at: string
          valor_pago: number | null
        }
        Insert: {
          campanha_cliente_id?: string | null
          competencia?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_processada?: string
          fatura_id?: string | null
          hash_processamento?: string | null
          id?: string | null
          ixc_cliente_id?: string | null
          ixc_contrato_id?: string | null
          ixc_fatura_id: string
          payload?: Json
          pontos_atribuidos: number
          pontos_gerados?: number
          status_processamento?: string
          sync_log_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          valor_pago?: number | null
        }
        Update: {
          campanha_cliente_id?: string | null
          competencia?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_processada?: string
          fatura_id?: string | null
          hash_processamento?: string | null
          id?: string | null
          ixc_cliente_id?: string | null
          ixc_contrato_id?: string | null
          ixc_fatura_id?: string
          payload?: Json
          pontos_atribuidos?: number
          pontos_gerados?: number
          status_processamento?: string
          sync_log_id?: string | null
          tenant_id?: string | null
          updated_at?: string
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_faturas_campanha_cliente"
            columns: ["campanha_cliente_id"]
            isOneToOne: false
            referencedRelation: "pontuacao_campanha_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_faturas_tenant"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontuacao_faturas_processadas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
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
        Relationships: []
      }
      pontuacao_sync_log: {
        Row: {
          erro_detalhes: string | null
          finalizado_em: string | null
          id: string
          iniciado_em: string | null
          ixc_connection_id: string | null
          mensagem: string | null
          payload: Json | null
          pontos_atribuidos: number
          registros_processados: number
          status: string | null
          sync_at: string
          tenant_id: string | null
          tipo: string | null
        }
        Insert: {
          erro_detalhes?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          ixc_connection_id?: string | null
          mensagem?: string | null
          payload?: Json | null
          pontos_atribuidos?: number
          registros_processados?: number
          status?: string | null
          sync_at?: string
          tenant_id?: string | null
          tipo?: string | null
        }
        Update: {
          erro_detalhes?: string | null
          finalizado_em?: string | null
          id?: string
          iniciado_em?: string | null
          ixc_connection_id?: string | null
          mensagem?: string | null
          payload?: Json | null
          pontos_atribuidos?: number
          registros_processados?: number
          status?: string | null
          sync_at?: string
          tenant_id?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pontuacao_sync_log_tenant_id_fkey"
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
        Relationships: []
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
        Relationships: []
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
