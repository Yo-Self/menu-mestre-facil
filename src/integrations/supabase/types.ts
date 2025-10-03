export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
      }
      restaurants: {
        Row: {
          address: string | null
          allow_ordering: boolean | null
          background_theme: string
          created_at: string | null
          cuisine: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          open: boolean
          owner_id: string
          phone: string | null
          slug: string
          updated_at: string | null
          waiter_call_enabled: boolean
          whatsapp_enabled: boolean
          whatsapp_phone: string | null
          latitude: number | null
          longitude: number | null
          table_payment: boolean
        }
        Insert: {
          address?: string | null
          allow_ordering?: boolean | null
          background_theme?: string
          created_at?: string | null
          cuisine?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          open?: boolean
          owner_id: string
          phone?: string | null
          slug: string
          updated_at?: string | null
          waiter_call_enabled?: boolean
          whatsapp_enabled?: boolean
          whatsapp_phone?: string | null
          latitude?: number | null
          longitude?: number | null
          table_payment?: boolean
        }
        Update: {
          address?: string | null
          allow_ordering?: boolean | null
          background_theme?: string
          created_at?: string | null
          cuisine?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          open?: boolean
          owner_id?: string
          phone?: string | null
          slug?: string
          updated_at?: string | null
          waiter_call_enabled?: boolean
          whatsapp_enabled?: boolean
          whatsapp_phone?: string | null
          latitude?: number | null
          longitude?: number | null
          table_payment?: boolean
        }
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
