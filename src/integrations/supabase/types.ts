export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          sort_order: number;
          tenant_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          sort_order?: number;
          tenant_id: string;
        };
        Update: {
          id?: string;
          name?: string;
          sort_order?: number;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      nfc_tags: {
        Row: {
          active: boolean;
          custom_redirect_url: string | null;
          id: string;
          table_label: string | null;
          tag_code: string;
          tenant_id: string | null;
        };
        Insert: {
          active?: boolean;
          custom_redirect_url?: string | null;
          id?: string;
          table_label?: string | null;
          tag_code: string;
          tenant_id?: string | null;
        };
        Update: {
          active?: boolean;
          custom_redirect_url?: string | null;
          id?: string;
          table_label?: string | null;
          tag_code?: string;
          tenant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "nfc_tags_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category_id: string | null;
          description: string | null;
          id: string;
          is_available: boolean;
          is_featured: boolean;
          media_gallery: Json;
          media_type: string;
          media_url: string | null;
          moderation_status: string;
          modifiers: Json;
          name: string;
          pending_media_gallery: Json;
          pending_media_type: string | null;
          pending_media_url: string | null;
          price_cents: number;
          sort_order: number;
          tenant_id: string;
        };
        Insert: {
          category_id?: string | null;
          description?: string | null;
          id?: string;
          is_available?: boolean;
          is_featured?: boolean;
          media_gallery?: Json;
          media_type?: string;
          media_url?: string | null;
          moderation_status?: string;
          modifiers?: Json;
          name: string;
          pending_media_gallery?: Json;
          pending_media_type?: string | null;
          pending_media_url?: string | null;
          price_cents: number;
          sort_order?: number;
          tenant_id: string;
        };
        Update: {
          category_id?: string | null;
          description?: string | null;
          id?: string;
          is_available?: boolean;
          is_featured?: boolean;
          media_gallery?: Json;
          media_type?: string;
          media_url?: string | null;
          moderation_status?: string;
          modifiers?: Json;
          name?: string;
          pending_media_gallery?: Json;
          pending_media_type?: string | null;
          pending_media_url?: string | null;
          price_cents?: number;
          sort_order?: number;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      telemetry_events: {
        Row: {
          category_id: string | null;
          created_at: string;
          duration_ms: number | null;
          event_type: string;
          id: number;
          metadata: Json;
          product_id: string | null;
          session_id: string;
          table_ref: string | null;
          tenant_id: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          event_type: string;
          id?: never;
          metadata?: Json;
          product_id?: string | null;
          session_id: string;
          table_ref?: string | null;
          tenant_id: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          duration_ms?: number | null;
          event_type?: string;
          id?: never;
          metadata?: Json;
          product_id?: string | null;
          session_id?: string;
          table_ref?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "telemetry_events_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "telemetry_events_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "telemetry_events_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      tenants: {
        Row: {
          active: boolean;
          bg_image_url: string | null;
          created_at: string;
          google_review_url: string | null;
          id: string;
          logo_url: string | null;
          menu_gate_enabled: boolean;
          name: string;
          owner_user_id: string | null;
          plan: string;
          slug: string;
          tagline: string | null;
          wifi_password: string | null;
          wifi_ssid: string | null;
        };
        Insert: {
          active?: boolean;
          bg_image_url?: string | null;
          created_at?: string;
          google_review_url?: string | null;
          id?: string;
          logo_url?: string | null;
          menu_gate_enabled?: boolean;
          name: string;
          owner_user_id?: string | null;
          plan?: string;
          slug: string;
          tagline?: string | null;
          wifi_password?: string | null;
          wifi_ssid?: string | null;
        };
        Update: {
          active?: boolean;
          bg_image_url?: string | null;
          created_at?: string;
          google_review_url?: string | null;
          id?: string;
          logo_url?: string | null;
          menu_gate_enabled?: boolean;
          name?: string;
          owner_user_id?: string | null;
          plan?: string;
          slug?: string;
          tagline?: string | null;
          wifi_password?: string | null;
          wifi_ssid?: string | null;
        };
        Relationships: [];
      };
      waiter_calls: {
        Row: {
          created_at: string;
          done_at: string | null;
          id: string;
          kind: string;
          status: string;
          table_ref: string | null;
          tenant_id: string;
        };
        Insert: {
          created_at?: string;
          done_at?: string | null;
          id?: string;
          kind?: string;
          status?: string;
          table_ref?: string | null;
          tenant_id: string;
        };
        Update: {
          created_at?: string;
          done_at?: string | null;
          id?: string;
          kind?: string;
          status?: string;
          table_ref?: string | null;
          tenant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "waiter_calls_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      menu_gate_leads: {
        Row: {
          id: string;
          tenant_id: string;
          full_name: string;
          whatsapp: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          full_name: string;
          whatsapp: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          full_name?: string;
          whatsapp?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: number;
          establishment: string;
          owner: string;
          phone: string;
          email: string;
          segment: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          establishment: string;
          owner: string;
          phone: string;
          email: string;
          segment: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: number;
          establishment?: string;
          owner?: string;
          phone?: string;
          email?: string;
          segment?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_menu: {
        Row: {
          id: string;
          slug: string;
          name: string;
          tagline: string | null;
          logo_url: string | null;
          bg_image_url: string | null;
          google_review_url: string | null;
          wifi_ssid: string | null;
          menu_gate_enabled: boolean;
        };
        Relationships: [];
      };
      public_menu_children: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          sort_order: number;
        };
        Relationships: [];
      };
      public_menu_products: {
        Row: {
          id: string;
          tenant_id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          price_cents: number;
          media_url: string | null;
          media_type: string;
          media_gallery: Json;
          modifiers: Json;
          is_available: boolean;
          is_featured: boolean;
          sort_order: number;
        };
        Relationships: [];
      };
      product_intelligence_view: {
        Row: {
          avg_attention_s: number | null;
          customize_opens: number | null;
          favorites: number | null;
          product_id: string | null;
          tenant_id: string | null;
          views: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "telemetry_events_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "telemetry_events_tenant_id_fkey";
            columns: ["tenant_id"];
            isOneToOne: false;
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      can_manage_tenant: { Args: { _tenant: string }; Returns: boolean };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      product_intelligence: {
        Args: { _days: number; _tenant: string };
        Returns: {
          avg_attention_s: number;
          customize_opens: number;
          favorites: number;
          product_id: string;
          views: number;
        }[];
      };
      call_waiter: { Args: { _tenant: string; _table: string; _kind?: string }; Returns: string };
      product_intelligence_v2: {
        Args: { _days: number; _tenant: string };
        Returns: {
          avg_attention_s: number;
          customize_opens: number;
          favorites: number;
          product_id: string;
          swipes: number;
          unique_sessions: number;
          views: number;
        }[];
      };
      table_stats: {
        Args: { _days: number; _tenant: string };
        Returns: {
          calls: number;
          sessions: number;
          table_ref: string;
        }[];
      };
      user_id_by_email: { Args: { _email: string }; Returns: string };
      tenant_wifi: {
        Args: { _slug: string };
        Returns: { ssid: string; password: string }[];
      };
      resolve_tag: {
        Args: { _code: string };
        Returns: {
          slug: string;
          table_label: string | null;
          custom_redirect_url: string | null;
          active: boolean;
        }[];
      };
    };
    Enums: {
      app_role: "super_admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "user"],
    },
  },
} as const;
