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
      ixc_clientes: {
        Row: {
          ativo: string | null
          created_at: string
          documento: string | null
          email: string | null
          id: string
          ixc_cliente_id: string
          nome: string
          payload_raw: Json
          telefone: string | null
          tenant_id: string
          ultima_atualizacao_ixc: string | null
          updated_at: string
        }
        Insert: {
          ativo?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          id?: string
          ixc_cliente_id: string
          nome: string
          payload_raw?: Json
          telefone?: string | null
          tenant_id: string
          ultima_atualizacao_ixc?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: string | null
          created_at?: string
          documento?: string | null
          email?: string | null
          id?: string
          ixc_cliente_id?: string
          nome?: string
          payload_raw?: Json
          telefone?: string | null
          tenant_id?: string
          ultima_atualizacao_ixc?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ixc_clientes_tenant_id_fkey"
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
        Relationships: []
      }
      ixc_recebiveis_raw: {
        Row: {
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          hash_payload: string
          id: string
          ixc_cliente_id: string
          ixc_connection_id: string
          ixc_contrato_id: string | null
          ixc_recebivel_id: string
          payload_raw: Json
          primeiro_sync_em: string
          processado_pontuacao: boolean
          processado_pontuacao_em: string | null
          status: string
          tenant_id: string
          ultima_atualizacao_ixc: string | null
          ultimo_sync_em: string
          updated_at: string
          valor: number | null
          valor_recebido: number
        }
        Insert: {
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          hash_payload: string
          id?: string
          ixc_cliente_id: string
          ixc_connection_id: string
          ixc_contrato_id?: string | null
          ixc_recebivel_id: string
          payload_raw?: Json
          primeiro_sync_em?: string
          processado_pontuacao?: boolean
          processado_pontuacao_em?: string | null
          status: string
          tenant_id: string
          ultima_atualizacao_ixc?: string | null
          ultimo_sync_em?: string
          updated_at?: string
          valor?: number | null
          valor_recebido: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          hash_payload?: string
          id?: string
          ixc_cliente_id?: string
          ixc_connection_id?: string
          ixc_contrato_id?: string | null
          ixc_recebivel_id?: string
          payload_raw?: Json
          primeiro_sync_em?: string
          processado_pontuacao?: boolean
          processado_pontuacao_em?: string | null
          status?: string
          tenant_id?: string
          ultima_atualizacao_ixc?: string | null
          ultimo_sync_em?: string
          updated_at?: string
          valor?: number | null
          valor_recebido?: number
        }
        Relationships: [
          {
            foreignKeyName: "ixc_recebiveis_raw_ixc_connection_id_fkey"
            columns: ["ixc_connection_id"]
            isOneToOne: false
            referencedRelation: "ixc_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ixc_recebiveis_raw_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
      pontuacao_campanha_regras: {
        Row: {
          ativo: boolean
          campanha_id: string
          created_at: string
          dias_antecedencia_min: number | null
          id: string
          pontos: number
          regra_codigo: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          campanha_id: string
          created_at?: string
          dias_antecedencia_min?: number | null
          id?: string
          pontos: number
          regra_codigo: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          campanha_id?: string
          created_at?: string
          dias_antecedencia_min?: number | null
          id?: string
          pontos?: number
          regra_codigo?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontuacao_campanha_regras_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "pontuacao_campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontuacao_campanha_regras_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pontuacao_campanhas: {
        Row: {
          ativa: boolean
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          nome: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontuacao_campanhas_tenant_id_fkey"
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          tipo_evento?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontuacao_historico_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pontuacao_movimentos: {
        Row: {
          campanha_cliente_id: string | null
          created_at: string
          descricao: string | null
          id: string
          idempotency_key: string
          ixc_cliente_id: string
          metadata: Json
          origem: string
          pontos: number
          referencia_externa_id: string | null
          referencia_externa_tipo: string | null
          tenant_id: string
          tipo_movimento: string
        }
        Insert: {
          campanha_cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          idempotency_key: string
          ixc_cliente_id: string
          metadata?: Json
          origem: string
          pontos: number
          referencia_externa_id?: string | null
          referencia_externa_tipo?: string | null
          tenant_id: string
          tipo_movimento: string
        }
        Update: {
          campanha_cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          idempotency_key?: string
          ixc_cliente_id?: string
          metadata?: Json
          origem?: string
          pontos?: number
          referencia_externa_id?: string | null
          referencia_externa_tipo?: string | null
          tenant_id?: string
          tipo_movimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontuacao_movimentos_campanha_cliente_id_fkey"
            columns: ["campanha_cliente_id"]
            isOneToOne: false
            referencedRelation: "pontuacao_campanha_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontuacao_movimentos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
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
          movimento_id: string | null
          observacoes: string | null
          pontos_utilizados: number
          responsavel_entrega: string | null
          status_resgate: string
          tenant_id: string
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
          movimento_id?: string | null
          observacoes?: string | null
          pontos_utilizados: number
          responsavel_entrega?: string | null
          status_resgate?: string
          tenant_id: string
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
          movimento_id?: string | null
          observacoes?: string | null
          pontos_utilizados?: number
          responsavel_entrega?: string | null
          status_resgate?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontuacao_resgates_movimento_id_fkey"
            columns: ["movimento_id"]
            isOneToOne: false
            referencedRelation: "pontuacao_movimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      pontuacao_saldos: {
        Row: {
          campanha_cliente_id: string | null
          created_at: string
          id: string
          ixc_cliente_id: string
          pontos_credito: number
          pontos_debito: number
          saldo: number
          tenant_id: string
          ultimo_movimento_em: string | null
          updated_at: string
        }
        Insert: {
          campanha_cliente_id?: string | null
          created_at?: string
          id?: string
          ixc_cliente_id: string
          pontos_credito?: number
          pontos_debito?: number
          saldo?: number
          tenant_id: string
          ultimo_movimento_em?: string | null
          updated_at?: string
        }
        Update: {
          campanha_cliente_id?: string | null
          created_at?: string
          id?: string
          ixc_cliente_id?: string
          pontos_credito?: number
          pontos_debito?: number
          saldo?: number
          tenant_id?: string
          ultimo_movimento_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontuacao_saldos_campanha_cliente_id_fkey"
            columns: ["campanha_cliente_id"]
            isOneToOne: false
            referencedRelation: "pontuacao_campanha_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontuacao_saldos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          referencia: string | null
          registros_processados: number
          status: string | null
          sync_at: string
          tenant_id: string | null
          tipo: string | null
          tipo_sync: string | null
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
          referencia?: string | null
          registros_processados?: number
          status?: string | null
          sync_at?: string
          tenant_id?: string | null
          tipo?: string | null
          tipo_sync?: string | null
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
          referencia?: string | null
          registros_processados?: number
          status?: string | null
          sync_at?: string
          tenant_id?: string | null
          tipo?: string | null
          tipo_sync?: string | null
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
      pontuacao_sync_state: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          ixc_connection_id: string
          last_success_at: string | null
          metadata: Json
          status: string
          sync_tipo: string
          tenant_id: string
          updated_at: string
          watermark_ref: string | null
          watermark_utc: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          ixc_connection_id: string
          last_success_at?: string | null
          metadata?: Json
          status?: string
          sync_tipo: string
          tenant_id: string
          updated_at?: string
          watermark_ref?: string | null
          watermark_utc?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          ixc_connection_id?: string
          last_success_at?: string | null
          metadata?: Json
          status?: string
          sync_tipo?: string
          tenant_id?: string
          updated_at?: string
          watermark_ref?: string | null
          watermark_utc?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pontuacao_sync_state_ixc_connection_id_fkey"
            columns: ["ixc_connection_id"]
            isOneToOne: false
            referencedRelation: "ixc_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pontuacao_sync_state_tenant_id_fkey"
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
          is_active: boolean
          role: string
          session_revoked_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          role?: string
          session_revoked_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          role?: string
          session_revoked_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_pontuacao_cliente: {
        Args: { target_cliente_id: string; target_tenant_id: string }
        Returns: boolean
      }
      is_pontuacao_admin: {
        Args: { target_tenant_id: string }
        Returns: boolean
      }
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
