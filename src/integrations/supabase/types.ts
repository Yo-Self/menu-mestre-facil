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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string | null
          id: string
          image_url: string | null
          name: string
          position: number | null
          restaurant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          position?: number | null
          restaurant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          position?: number | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      complement_groups: {
        Row: {
          created_at: string
          description: string | null
          dish_id: string
          id: string
          max_selections: number
          position: number | null
          required: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          dish_id: string
          id?: string
          max_selections?: number
          position?: number | null
          required?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          dish_id?: string
          id?: string
          max_selections?: number
          position?: number | null
          required?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_complement_groups_dish"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      complements: {
        Row: {
          created_at: string
          description: string | null
          group_id: string
          id: string
          image_url: string | null
          ingredients: string | null
          name: string
          position: number | null
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          group_id: string
          id?: string
          image_url?: string | null
          ingredients?: string | null
          name: string
          position?: number | null
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_id?: string
          id?: string
          image_url?: string | null
          ingredients?: string | null
          name?: string
          position?: number | null
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_complements_group"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "complement_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      dish_categories: {
        Row: {
          category_id: string
          created_at: string | null
          dish_id: string
          id: string
          position: number
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          dish_id: string
          id?: string
          position?: number
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          dish_id?: string
          id?: string
          position?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dish_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_categories_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
        ]
      }
      dishes: {
        Row: {
          allergens: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string
          ingredients: string | null
          is_available: boolean | null
          is_featured: boolean | null
          name: string
          portion: string | null
          price: number
          restaurant_id: string
          tags: string[]
          updated_at: string | null
        }
        Insert: {
          allergens?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url: string
          ingredients?: string | null
          is_available?: boolean | null
          is_featured?: boolean | null
          name: string
          portion?: string | null
          price: number
          restaurant_id: string
          tags?: string[]
          updated_at?: string | null
        }
        Update: {
          allergens?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string
          ingredients?: string | null
          is_available?: boolean | null
          is_featured?: boolean | null
          name?: string
          portion?: string | null
          price?: number
          restaurant_id?: string
          tags?: string[]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dishes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dishes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_organization: boolean | null
          slug: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_organization?: boolean | null
          slug: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_organization?: boolean | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      restaurants: {
        Row: {
          created_at: string | null
          cuisine_type: string
          description: string | null
          id: string
          image_url: string
          name: string
          slug: string
          updated_at: string | null
          user_id: string | null
          waiter_call_enabled: boolean | null
          welcome_message: string | null
          whatsapp_custom_message: string | null
          whatsapp_enabled: boolean | null
          whatsapp_phone: string | null
        }
        Insert: {
          created_at?: string | null
          cuisine_type: string
          description?: string | null
          id?: string
          image_url: string
          name: string
          slug: string
          updated_at?: string | null
          user_id?: string | null
          waiter_call_enabled?: boolean | null
          welcome_message?: string | null
          whatsapp_custom_message?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_phone?: string | null
        }
        Update: {
          created_at?: string | null
          cuisine_type?: string
          description?: string | null
          id?: string
          image_url?: string
          name?: string
          slug?: string
          updated_at?: string | null
          user_id?: string | null
          waiter_call_enabled?: boolean | null
          welcome_message?: string | null
          whatsapp_custom_message?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waiter_calls: {
        Row: {
          attended_at: string | null
          attended_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          restaurant_id: string
          status: string
          table_number: number
        }
        Insert: {
          attended_at?: string | null
          attended_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          restaurant_id: string
          status?: string
          table_number: number
        }
        Update: {
          attended_at?: string | null
          attended_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          restaurant_id?: string
          status?: string
          table_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "waiter_calls_attended_by_fkey"
            columns: ["attended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bytea_to_text: {
        Args: { data: string }
        Returns: string
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_delete: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_get: {
        Args: { data: Json; uri: string } | { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
      }
      http_list_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_post: {
        Args:
          | { content: string; content_type: string; uri: string }
          | { data: Json; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
      }
      http_reset_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      import_restaurant_from_json: {
        Args: { p_cuisine?: string; p_payload: Json }
        Returns: undefined
      }
      import_restaurant_with_complements_from_json: {
        Args: { p_cuisine?: string; p_payload: Json }
        Returns: undefined
      }
      text_to_bytea: {
        Args: { data: string }
        Returns: string
      }
      urlencode: {
        Args: { data: Json } | { string: string } | { string: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown | null
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    | keyof DefaultSchema["CompositeTypes"],
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
