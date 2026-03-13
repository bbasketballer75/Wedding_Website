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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      guest_uploads: {
        Row: {
          created_at: string | null
          guest_email: string
          guest_name: string
          id: string
          message: string | null
          photo_urls: string[] | null
          status: string | null
          video_urls: string[] | null
        }
        Insert: {
          created_at?: string | null
          guest_email: string
          guest_name: string
          id?: string
          message?: string | null
          photo_urls?: string[] | null
          status?: string | null
          video_urls?: string[] | null
        }
        Update: {
          created_at?: string | null
          guest_email?: string
          guest_name?: string
          id?: string
          message?: string | null
          photo_urls?: string[] | null
          status?: string | null
          video_urls?: string[] | null
        }
        Relationships: []
      }
      guestbook_comments: {
        Row: {
          author: string
          content: string
          created_at: string | null
          id: string
          message_id: string
        }
        Insert: {
          author?: string
          content: string
          created_at?: string | null
          id?: string
          message_id: string
        }
        Update: {
          author?: string
          content?: string
          created_at?: string | null
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guestbook_comments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "guestbook_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      guestbook_messages: {
        Row: {
          content: string
          created_at: string | null
          email: string
          id: string
          ip_address: string | null
          media_url: string | null
          name: string
          rate_limited: boolean | null
          reactions: Json | null
          type: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          email: string
          id?: string
          ip_address?: string | null
          media_url?: string | null
          name: string
          rate_limited?: boolean | null
          reactions?: Json | null
          type?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          email?: string
          id?: string
          ip_address?: string | null
          media_url?: string | null
          name?: string
          rate_limited?: boolean | null
          reactions?: Json | null
          type?: string | null
        }
        Relationships: []
      }
      moderation_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_name: string | null
          actor_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          from_status: string | null
          id: string
          metadata: Json
          summary: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          from_status?: string | null
          id?: string
          metadata?: Json
          summary: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_name?: string | null
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          summary?: string
          to_status?: string | null
        }
        Relationships: []
      }
      site_editorial_features: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          metadata: Json
          slot: string
          source_id: string | null
          source_label: string | null
          source_type: string
          source_url: string | null
          summary: string | null
          title: string
          trail: string | null
          updated_at: string
          updated_by_email: string | null
          updated_by_user_id: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          metadata?: Json
          slot: string
          source_id?: string | null
          source_label?: string | null
          source_type: string
          source_url?: string | null
          summary?: string | null
          title: string
          trail?: string | null
          updated_at?: string
          updated_by_email?: string | null
          updated_by_user_id?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          metadata?: Json
          slot?: string
          source_id?: string | null
          source_label?: string | null
          source_type?: string
          source_url?: string | null
          summary?: string | null
          title?: string
          trail?: string | null
          updated_at?: string
          updated_by_email?: string | null
          updated_by_user_id?: string | null
        }
        Relationships: []
      }
      photos: {
        Row: {
          caption: string | null
          category: string | null
          created_at: string | null
          date: string | null
          faces: Json | null
          id: string
          is_professional: boolean | null
          likes: number | null
          location: string | null
          photographer: string | null
          tags: string[] | null
          thumbnail: string
          url: string
        }
        Insert: {
          caption?: string | null
          category?: string | null
          created_at?: string | null
          date?: string | null
          faces?: Json | null
          id?: string
          is_professional?: boolean | null
          likes?: number | null
          location?: string | null
          photographer?: string | null
          tags?: string[] | null
          thumbnail: string
          url: string
        }
        Update: {
          caption?: string | null
          category?: string | null
          created_at?: string | null
          date?: string | null
          faces?: Json | null
          id?: string
          is_professional?: boolean | null
          likes?: number | null
          location?: string | null
          photographer?: string | null
          tags?: string[] | null
          thumbnail?: string
          url?: string
        }
        Relationships: []
      }
      rate_limit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string
          request_count: number | null
          window_start: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address: string
          request_count?: number | null
          window_start?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string
          request_count?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_rate_limit: {
        Args: {
          p_action: string
          p_ip_address: string
          p_max_requests?: number
          p_window_minutes?: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          remaining: number
          reset_after_seconds: number
        }[]
      }
      cleanup_old_rate_limits: { Args: never; Returns: number }
      get_guestbook_messages_with_comments: {
        Args: never
        Returns: {
          comments: Json
          content: string
          created_at: string
          email: string
          id: string
          media_url: string
          name: string
          reactions: Json
          type: string
        }[]
      }
      increment_rate_limit: {
        Args: {
          p_action: string
          p_ip_address: string
          p_window_minutes?: number
        }
        Returns: undefined
      }
      submit_guestbook_message_with_rate_limit: {
        Args: {
          p_content: string
          p_email: string
          p_max_requests?: number
          p_media_url?: string
          p_name: string
          p_type?: string
          p_window_minutes?: number
        }
        Returns: {
          error_message: string
          message_id: string
          rate_limit_remaining: number
          rate_limit_reset_after: number
          success: boolean
        }[]
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
