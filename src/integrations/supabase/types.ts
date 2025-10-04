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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          id: string
          ip_address: unknown | null
          new_values: Json | null
          old_values: Json | null
          operation: string
          record_id: string | null
          table_name: string
          timestamp: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          record_id?: string | null
          table_name: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          ip_address?: unknown | null
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          record_id?: string | null
          table_name?: string
          timestamp?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
            referencedRelation: "public_menu_view"
            referencedColumns: ["restaurant_id"]
          },
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
          id: string
          max_selections: number
          required: boolean
          restaurant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          max_selections?: number
          required?: boolean
          restaurant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          max_selections?: number
          required?: boolean
          restaurant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complement_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_menu_view"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "complement_groups_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
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
          is_active: boolean
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
          is_active?: boolean
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
          is_active?: boolean
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
            foreignKeyName: "dish_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "public_menu_view"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "dish_categories_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_categories_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "public_menu_view"
            referencedColumns: ["dish_id"]
          },
        ]
      }
      dish_complement_groups: {
        Row: {
          complement_group_id: string
          created_at: string | null
          dish_id: string
          id: string
          position: number | null
        }
        Insert: {
          complement_group_id: string
          created_at?: string | null
          dish_id: string
          id?: string
          position?: number | null
        }
        Update: {
          complement_group_id?: string
          created_at?: string | null
          dish_id?: string
          id?: string
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dish_complement_groups_complement_group_id_fkey"
            columns: ["complement_group_id"]
            isOneToOne: false
            referencedRelation: "complement_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_complement_groups_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dish_complement_groups_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "public_menu_view"
            referencedColumns: ["dish_id"]
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
            foreignKeyName: "dishes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "public_menu_view"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "dishes_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_menu_view"
            referencedColumns: ["restaurant_id"]
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
      import_logs: {
        Row: {
          categories_count: number | null
          complements_count: number | null
          completed_at: string | null
          created_at: string
          dishes_count: number | null
          duration_ms: number | null
          error_message: string | null
          id: string
          items_processed: number | null
          items_total: number | null
          metadata: Json | null
          restaurant_id: string | null
          retry_count: number | null
          scraped_data: Json | null
          source: string
          started_at: string | null
          status: Database["public"]["Enums"]["import_status"]
          updated_at: string
          url: string
          user_id: string | null
        }
        Insert: {
          categories_count?: number | null
          complements_count?: number | null
          completed_at?: string | null
          created_at?: string
          dishes_count?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          items_processed?: number | null
          items_total?: number | null
          metadata?: Json | null
          restaurant_id?: string | null
          retry_count?: number | null
          scraped_data?: Json | null
          source?: string
          started_at?: string | null
          status: Database["public"]["Enums"]["import_status"]
          updated_at?: string
          url: string
          user_id?: string | null
        }
        Update: {
          categories_count?: number | null
          complements_count?: number | null
          completed_at?: string | null
          created_at?: string
          dishes_count?: number | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          items_processed?: number | null
          items_total?: number | null
          metadata?: Json | null
          restaurant_id?: string | null
          retry_count?: number | null
          scraped_data?: Json | null
          source?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          updated_at?: string
          url?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_menu_view"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "import_logs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            referencedRelation: "public_menu_view"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "menus_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          dish_id: string | null
          id: string
          order_id: string
          price_at_time_of_order: number
          quantity: number
          selected_complements: Json | null
        }
        Insert: {
          created_at?: string
          dish_id?: string | null
          id?: string
          order_id: string
          price_at_time_of_order: number
          quantity: number
          selected_complements?: Json | null
        }
        Update: {
          created_at?: string
          dish_id?: string | null
          id?: string
          order_id?: string
          price_at_time_of_order?: number
          quantity?: number
          selected_complements?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "dishes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_dish_id_fkey"
            columns: ["dish_id"]
            isOneToOne: false
            referencedRelation: "public_menu_view"
            referencedColumns: ["dish_id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_info: Json | null
          id: string
          restaurant_id: string
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          table_name: string | null
          total_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_info?: Json | null
          id?: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          table_name?: string | null
          total_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_info?: Json | null
          id?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          table_name?: string | null
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "public_menu_view"
            referencedColumns: ["restaurant_id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
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
          id?: string
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
          address: string | null
          address_active: boolean
          background_light: string | null
          background_night: string | null
          created_at: string | null
          cuisine_type: string
          description: string | null
          id: string
          image_url: string
          is_open_for_orders: boolean
          latitude: number | null
          longitude: number | null
          name: string
          open: boolean
          slug: string
          table_payment: boolean
          updated_at: string | null
          user_id: string | null
          waiter_call_enabled: boolean | null
          welcome_message: string | null
          whatsapp_custom_message: string | null
          whatsapp_enabled: boolean | null
          whatsapp_phone: string | null
        }
        Insert: {
          address?: string | null
          address_active?: boolean
          background_light?: string | null
          background_night?: string | null
          created_at?: string | null
          cuisine_type: string
          description?: string | null
          id?: string
          image_url: string
          is_open_for_orders?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          open?: boolean
          slug: string
          table_payment?: boolean
          updated_at?: string | null
          user_id?: string | null
          waiter_call_enabled?: boolean | null
          welcome_message?: string | null
          whatsapp_custom_message?: string | null
          whatsapp_enabled?: boolean | null
          whatsapp_phone?: string | null
        }
        Update: {
          address?: string | null
          address_active?: boolean
          background_light?: string | null
          background_night?: string | null
          created_at?: string | null
          cuisine_type?: string
          description?: string | null
          id?: string
          image_url?: string
          is_open_for_orders?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          open?: boolean
          slug?: string
          table_payment?: boolean
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
            referencedRelation: "public_menu_view"
            referencedColumns: ["restaurant_id"]
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
      public_menu_view: {
        Row: {
          allergens: string | null
          category_id: string | null
          category_image: string | null
          category_name: string | null
          category_position: number | null
          dish_description: string | null
          dish_id: string | null
          dish_image: string | null
          dish_name: string | null
          dish_price: number | null
          ingredients: string | null
          is_featured: boolean | null
          portion: string | null
          restaurant_description: string | null
          restaurant_id: string | null
          restaurant_image: string | null
          restaurant_name: string | null
          restaurant_slug: string | null
          waiter_call_enabled: boolean | null
          whatsapp_enabled: boolean | null
          whatsapp_phone: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      bytea_to_text: {
        Args: { data: string }
        Returns: string
      }
      can_access_restaurant: {
        Args: { restaurant_uuid: string }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          p_limit_seconds?: number
          p_max_operations?: number
          p_operation: string
        }
        Returns: boolean
      }
      get_public_restaurant_data: {
        Args: { p_restaurant_slug: string }
        Returns: Json
      }
      get_restaurant_by_slug: {
        Args: { p_slug: string }
        Returns: Json
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
      log_audit_entry: {
        Args: {
          p_new_values?: Json
          p_old_values?: Json
          p_operation: string
          p_record_id: string
          p_table_name: string
        }
        Returns: undefined
      }
      sanitize_text_input: {
        Args: { input_text: string }
        Returns: string
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
      import_status:
        | "scraping"
        | "processing"
        | "preview_ready"
        | "importing"
        | "import_success"
        | "import_failed"
        | "scraping_failed"
        | "processing_failed"
        | "cancelled"
      order_status:
        | "pending_payment"
        | "new"
        | "in_preparation"
        | "ready"
        | "finished"
        | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      import_status: [
        "scraping",
        "processing",
        "preview_ready",
        "importing",
        "import_success",
        "import_failed",
        "scraping_failed",
        "processing_failed",
        "cancelled",
      ],
      order_status: [
        "pending_payment",
        "new",
        "in_preparation",
        "ready",
        "finished",
        "cancelled",
      ],
    },
  },
} as const
