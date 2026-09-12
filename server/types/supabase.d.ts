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
      admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      affiliate_invites: {
        Row: {
          affiliate_id: string
          code_hash: string
          code_prefix: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          redeemed_at: string | null
          redeemed_ip: unknown
          revoked_at: string | null
        }
        Insert: {
          affiliate_id: string
          code_hash: string
          code_prefix: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          redeemed_at?: string | null
          redeemed_ip?: unknown
          revoked_at?: string | null
        }
        Update: {
          affiliate_id?: string
          code_hash?: string
          code_prefix?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          redeemed_at?: string | null
          redeemed_ip?: unknown
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_invites_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_slug_aliases: {
        Row: {
          affiliate_id: string
          created_at: string
          expires_at: string
          slug: string
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          expires_at: string
          slug: string
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          expires_at?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_slug_aliases_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          avatar_path: string | null
          created_at: string
          created_by: string | null
          display_name: string
          first_name: string | null
          herofx_code: string | null
          herofx_code_source: string | null
          herofx_linked_at: string | null
          house_share: boolean
          id: string
          last_name: string | null
          lite_telegram_url: string | null
          locale: string
          notes: string | null
          notification_prefs: Json
          onboarding: Json
          slug: string
          slug_changed_at: string | null
          status: Database["public"]["Enums"]["affiliate_status"]
          timezone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          first_name?: string | null
          herofx_code?: string | null
          herofx_code_source?: string | null
          herofx_linked_at?: string | null
          house_share?: boolean
          id?: string
          last_name?: string | null
          lite_telegram_url?: string | null
          locale?: string
          notes?: string | null
          notification_prefs?: Json
          onboarding?: Json
          slug: string
          slug_changed_at?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          timezone?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          first_name?: string | null
          herofx_code?: string | null
          herofx_code_source?: string | null
          herofx_linked_at?: string | null
          house_share?: boolean
          id?: string
          last_name?: string | null
          lite_telegram_url?: string | null
          locale?: string
          notes?: string | null
          notification_prefs?: Json
          onboarding?: Json
          slug?: string
          slug_changed_at?: string | null
          status?: Database["public"]["Enums"]["affiliate_status"]
          timezone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_kind: string
          actor_user_id: string | null
          at: string
          id: number
          ip: unknown
          meta: Json
          subject_affiliate_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_kind: string
          actor_user_id?: string | null
          at?: string
          id?: number
          ip?: unknown
          meta?: Json
          subject_affiliate_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_kind?: string
          actor_user_id?: string | null
          at?: string
          id?: number
          ip?: unknown
          meta?: Json
          subject_affiliate_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_subject_affiliate_id_fkey"
            columns: ["subject_affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      changelog: {
        Row: {
          body: string
          created_at: string
          id: number
          kind: string
          published_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: number
          kind: string
          published_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: number
          kind?: string
          published_at?: string | null
          title?: string
        }
        Relationships: []
      }
      email_changes: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          new_email: string
          requested_ip: unknown
          requested_ua: string | null
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          new_email: string
          requested_ip?: unknown
          requested_ua?: string | null
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          new_email?: string
          requested_ip?: unknown
          requested_ua?: string | null
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          affiliate_id: string
          body: string
          created_at: string
          id: number
          kind: string
        }
        Insert: {
          affiliate_id: string
          body: string
          created_at?: string
          id?: number
          kind: string
        }
        Update: {
          affiliate_id?: string
          body?: string
          created_at?: string
          id?: number
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      gdpr_requests: {
        Row: {
          affiliate_id: string
          completed_at: string | null
          created_at: string
          execute_after: string | null
          id: string
          kind: string
          reason: string | null
          reason_note: string | null
          status: string
        }
        Insert: {
          affiliate_id: string
          completed_at?: string | null
          created_at?: string
          execute_after?: string | null
          id?: string
          kind: string
          reason?: string | null
          reason_note?: string | null
          status?: string
        }
        Update: {
          affiliate_id?: string
          completed_at?: string | null
          created_at?: string
          execute_after?: string | null
          id?: string
          kind?: string
          reason?: string | null
          reason_note?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gdpr_requests_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      herofx_clients: {
        Row: {
          country_iso2: string | null
          deposits_usd: number
          email_fingerprint: string | null
          ftd_date: string | null
          last_seen: string | null
          live_balance_usd: number
          name: string | null
          own_codes: string[]
          path_codes: string[]
          referrer_code: string | null
          registration_date: string | null
          status: string | null
          user_id: number
          withdrawals_usd: number
        }
        Insert: {
          country_iso2?: string | null
          deposits_usd?: number
          email_fingerprint?: string | null
          ftd_date?: string | null
          last_seen?: string | null
          live_balance_usd?: number
          name?: string | null
          own_codes?: string[]
          path_codes?: string[]
          referrer_code?: string | null
          registration_date?: string | null
          status?: string | null
          user_id: number
          withdrawals_usd?: number
        }
        Update: {
          country_iso2?: string | null
          deposits_usd?: number
          email_fingerprint?: string | null
          ftd_date?: string | null
          last_seen?: string | null
          live_balance_usd?: number
          name?: string | null
          own_codes?: string[]
          path_codes?: string[]
          referrer_code?: string | null
          registration_date?: string | null
          status?: string | null
          user_id?: number
          withdrawals_usd?: number
        }
        Relationships: []
      }
      herofx_commissions_daily: {
        Row: {
          available_usd: number
          calculated_usd: number
          code: string
          id: number
          period: string
          program: string | null
          status: string | null
        }
        Insert: {
          available_usd?: number
          calculated_usd?: number
          code: string
          id?: number
          period: string
          program?: string | null
          status?: string | null
        }
        Update: {
          available_usd?: number
          calculated_usd?: number
          code?: string
          id?: number
          period?: string
          program?: string | null
          status?: string | null
        }
        Relationships: []
      }
      herofx_freshness: {
        Row: {
          cadence_seconds: number | null
          job: string
          last_success_at: string | null
          seconds_since_success: number | null
          status: string | null
        }
        Insert: {
          cadence_seconds?: number | null
          job: string
          last_success_at?: string | null
          seconds_since_success?: number | null
          status?: string | null
        }
        Update: {
          cadence_seconds?: number | null
          job?: string
          last_success_at?: string | null
          seconds_since_success?: number | null
          status?: string | null
        }
        Relationships: []
      }
      herofx_metrics_daily: {
        Row: {
          code: string
          day: string
          demo_accounts: number
          deposited_users: number
          deposits_usd: number
          joined_users: number
          kyc_verified: number
          real_accounts: number
          traded_volume: number
          withdrawals_usd: number
        }
        Insert: {
          code: string
          day: string
          demo_accounts?: number
          deposited_users?: number
          deposits_usd?: number
          joined_users?: number
          kyc_verified?: number
          real_accounts?: number
          traded_volume?: number
          withdrawals_usd?: number
        }
        Update: {
          code?: string
          day?: string
          demo_accounts?: number
          deposited_users?: number
          deposits_usd?: number
          joined_users?: number
          kyc_verified?: number
          real_accounts?: number
          traded_volume?: number
          withdrawals_usd?: number
        }
        Relationships: []
      }
      herofx_payments: {
        Row: {
          amount_usd: number
          created_at: string
          kind: string
          path_codes: string[]
          payment_id: number
          psp: string | null
          referrer_code: string | null
          user_id: number | null
        }
        Insert: {
          amount_usd?: number
          created_at: string
          kind: string
          path_codes?: string[]
          payment_id: number
          psp?: string | null
          referrer_code?: string | null
          user_id?: number | null
        }
        Update: {
          amount_usd?: number
          created_at?: string
          kind?: string
          path_codes?: string[]
          payment_id?: number
          psp?: string | null
          referrer_code?: string | null
          user_id?: number | null
        }
        Relationships: []
      }
      herofx_status_changes: {
        Row: {
          changed_at: string
          new_status: string
          old_status: string | null
          user_id: number
        }
        Insert: {
          changed_at: string
          new_status?: string
          old_status?: string | null
          user_id: number
        }
        Update: {
          changed_at?: string
          new_status?: string
          old_status?: string | null
          user_id?: number
        }
        Relationships: []
      }
      herofx_sync_state: {
        Row: {
          client_count: number
          id: boolean
          last_attempt_at: string | null
          last_error: string | null
          last_success_at: string | null
          payment_count: number
        }
        Insert: {
          client_count?: number
          id?: boolean
          last_attempt_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          payment_count?: number
        }
        Update: {
          client_count?: number
          id?: boolean
          last_attempt_at?: string | null
          last_error?: string | null
          last_success_at?: string | null
          payment_count?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          affiliate_id: string
          created_at: string
          id: number
          kind: string
          payload: Json
          read_at: string | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: number
          kind: string
          payload?: Json
          read_at?: string | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: number
          kind?: string
          payload?: Json
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      password_resets: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          requested_ip: unknown
          requested_ua: string | null
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          requested_ip?: unknown
          requested_ua?: string | null
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          requested_ip?: unknown
          requested_ua?: string | null
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          locked_until: string | null
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          locked_until?: string | null
          window_start?: string
        }
        Update: {
          bucket?: string
          count?: number
          locked_until?: string | null
          window_start?: string
        }
        Relationships: []
      }
      referral_clicks: {
        Row: {
          affiliate_id: string
          day: string
          id: number
          occurred_at: string
          role: string
          visitor_hash: string
        }
        Insert: {
          affiliate_id: string
          day: string
          id?: number
          occurred_at?: string
          role: string
          visitor_hash: string
        }
        Update: {
          affiliate_id?: string
          day?: string
          id?: number
          occurred_at?: string
          role?: string
          visitor_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_visits: {
        Row: {
          affiliate_id: string
          country: string | null
          day: string
          id: number
          occurred_at: string
          path: string | null
          referrer_host: string | null
          source: string
          visitor_hash: string
        }
        Insert: {
          affiliate_id: string
          country?: string | null
          day: string
          id?: number
          occurred_at?: string
          path?: string | null
          referrer_host?: string | null
          source?: string
          visitor_hash: string
        }
        Update: {
          affiliate_id?: string
          country?: string | null
          day?: string
          id?: number
          occurred_at?: string
          path?: string | null
          referrer_host?: string | null
          source?: string
          visitor_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_visits_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          absolute_expires_at: string
          id: string
          idle_expires_at: string
          impersonating_affiliate_id: string | null
          impersonation_started_at: string | null
          ip: unknown
          issued_at: string
          last_seen_at: string
          revoked_at: string | null
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          absolute_expires_at: string
          id?: string
          idle_expires_at: string
          impersonating_affiliate_id?: string | null
          impersonation_started_at?: string | null
          ip?: unknown
          issued_at?: string
          last_seen_at?: string
          revoked_at?: string | null
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          absolute_expires_at?: string
          id?: string
          idle_expires_at?: string
          impersonating_affiliate_id?: string | null
          impersonation_started_at?: string | null
          ip?: unknown
          issued_at?: string
          last_seen_at?: string
          revoked_at?: string | null
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_impersonating_affiliate_id_fkey"
            columns: ["impersonating_affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      affiliate_day_counts: {
        Args: { p_affiliate_id: string; p_days?: number; p_timezone?: string }
        Returns: Json
      }
      affiliate_traffic: {
        Args: {
          p_affiliate_id: string
          p_since: string
          p_timezone?: string
          p_until?: string
        }
        Returns: Json
      }
      herofx_apply_snapshot: {
        Args: {
          p_clients: Json
          p_commissions: Json
          p_freshness: Json
          p_metrics: Json
          p_payments: Json
          p_status_changes: Json
        }
        Returns: Json
      }
      herofx_network_figures: {
        Args: { p_code: string; p_since?: string; p_until?: string }
        Returns: Json
      }
      herofx_sub_ibs: {
        Args: { p_code: string; p_since?: string; p_until?: string }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      program_analytics: {
        Args: {
          p_leaders?: number
          p_since: string
          p_timezone?: string
          p_until?: string
        }
        Returns: Json
      }
      rl_hit: {
        Args: {
          p_bucket: string
          p_limit: number
          p_lock: string
          p_window: string
        }
        Returns: {
          allowed: boolean
          retry_after: number
        }[]
      }
      rl_reset: { Args: { p_bucket: string }; Returns: undefined }
      rl_sweep: { Args: never; Returns: undefined }
    }
    Enums: {
      affiliate_status: "active" | "revoked"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      affiliate_status: ["active", "revoked"],
    },
  },
} as const
