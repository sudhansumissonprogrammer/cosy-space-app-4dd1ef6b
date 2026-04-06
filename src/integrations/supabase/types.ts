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
      abandoned_carts: {
        Row: {
          cart_items: Json
          created_at: string
          customer_email: string | null
          customer_phone: string | null
          id: string
          recovered: boolean
          session_token: string | null
          store_id: string
        }
        Insert: {
          cart_items?: Json
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          id?: string
          recovered?: boolean
          session_token?: string | null
          store_id: string
        }
        Update: {
          cart_items?: Json
          created_at?: string
          customer_email?: string | null
          customer_phone?: string | null
          id?: string
          recovered?: boolean
          session_token?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_carts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abandoned_carts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          name: string
          slug: string
          store_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          name: string
          slug: string
          store_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_amount: number
          starts_at: string
          store_id: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number
          starts_at?: string
          store_id: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number
          starts_at?: string
          store_id?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string | null
          created_at: string
          full_name: string | null
          id: string
          is_default: boolean
          label: string
          phone: string | null
          pincode: string | null
          state: string | null
          storefront_customer_id: string
          street_address: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_default?: boolean
          label?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          storefront_customer_id: string
          street_address?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_default?: boolean
          label?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          storefront_customer_id?: string
          street_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_storefront_customer_id_fkey"
            columns: ["storefront_customer_id"]
            isOneToOne: false
            referencedRelation: "storefront_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_leads: {
        Row: {
          created_at: string
          id: string
          name: string | null
          phone: string
          product_id: string | null
          product_name: string | null
          source: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          phone: string
          product_id?: string | null
          product_name?: string | null
          source?: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          phone?: string
          product_id?: string | null
          product_name?: string | null
          source?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_leads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_leads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_leads_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          storefront_customer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          storefront_customer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          storefront_customer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_wishlists_storefront_customer_id_fkey"
            columns: ["storefront_customer_id"]
            isOneToOne: false
            referencedRelation: "storefront_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: Json | null
          created_at: string
          email: string
          id: string
          name: string | null
          order_count: number
          phone: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          created_at?: string
          email: string
          id?: string
          name?: string | null
          order_count?: number
          phone?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          address?: Json | null
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          order_count?: number
          phone?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_menu_config: {
        Row: {
          display_order: number
          id: string
          menu_key: string
          menu_label: string
          status: string
          updated_at: string
        }
        Insert: {
          display_order?: number
          id?: string
          menu_key: string
          menu_label: string
          status?: string
          updated_at?: string
        }
        Update: {
          display_order?: number
          id?: string
          menu_key?: string
          menu_label?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      error_logs: {
        Row: {
          context: string | null
          created_at: string
          id: string
          level: string
          message: string
          metadata: Json | null
          stack: string | null
          store_id: string | null
          url: string | null
          user_agent: string | null
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          level?: string
          message: string
          metadata?: Json | null
          stack?: string | null
          store_id?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          stack?: string | null
          store_id?: string | null
          url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "error_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      media_library: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url: string
          id?: string
          store_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_library_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_library_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          total: number
          unit_price: number
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          advance_paid: number
          balance_due: number
          checkout_token: string | null
          city: string | null
          created_at: string
          currency: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          notes: string | null
          order_number: number
          payment_method: string
          payment_type: string
          pincode: string | null
          state: string | null
          status: string
          store_id: string
          storefront_customer_id: string | null
          street_address: string | null
          total: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          advance_paid?: number
          balance_due?: number
          checkout_token?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          payment_method?: string
          payment_type?: string
          pincode?: string | null
          state?: string | null
          status?: string
          store_id: string
          storefront_customer_id?: string | null
          street_address?: string | null
          total?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          advance_paid?: number
          balance_due?: number
          checkout_token?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          notes?: string | null
          order_number?: number
          payment_method?: string
          payment_type?: string
          pincode?: string | null
          state?: string | null
          status?: string
          store_id?: string
          storefront_customer_id?: string | null
          street_address?: string | null
          total?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_storefront_customer_id_fkey"
            columns: ["storefront_customer_id"]
            isOneToOne: false
            referencedRelation: "storefront_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          path: string | null
          store_id: string
          visitor_ip: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path?: string | null
          store_id: string
          visitor_ip?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string | null
          store_id?: string
          visitor_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_views_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_views_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          price: number
          product_limit: number | null
          slug: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          product_limit?: number | null
          slug: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          product_limit?: number | null
          slug?: string
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          created_at: string
          default_currency: string
          id: string
          platform_name: string
          updated_at: string
          wa_access_token: string | null
          wa_business_phone: string | null
          wa_phone_number_id: string | null
        }
        Insert: {
          created_at?: string
          default_currency?: string
          id?: string
          platform_name?: string
          updated_at?: string
          wa_access_token?: string | null
          wa_business_phone?: string | null
          wa_phone_number_id?: string | null
        }
        Update: {
          created_at?: string
          default_currency?: string
          id?: string
          platform_name?: string
          updated_at?: string
          wa_access_token?: string | null
          wa_business_phone?: string | null
          wa_phone_number_id?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          product_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          product_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          created_at: string
          customer_name: string
          id: string
          is_verified: boolean
          product_id: string
          rating: number
          review_text: string | null
          store_id: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          id?: string
          is_verified?: boolean
          product_id: string
          rating: number
          review_text?: string | null
          store_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          id?: string
          is_verified?: boolean
          product_id?: string
          rating?: number
          review_text?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          name: string
          price: number | null
          product_id: string
          sku: string | null
          stock_quantity: number
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number | null
          product_id: string
          sku?: string | null
          stock_quantity?: number
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number | null
          product_id?: string
          sku?: string | null
          stock_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          cost_price: number | null
          created_at: string
          currency: string
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          is_best_selling: boolean
          name: string
          partial_payment_enabled: boolean
          partial_payment_type: string
          partial_payment_value: number | null
          price: number
          sale_price: number | null
          sku: string | null
          slug: string | null
          stock_quantity: number
          store_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_best_selling?: boolean
          name: string
          partial_payment_enabled?: boolean
          partial_payment_type?: string
          partial_payment_value?: number | null
          price?: number
          sale_price?: number | null
          sku?: string | null
          slug?: string | null
          stock_quantity?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_price?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_best_selling?: boolean
          name?: string
          partial_payment_enabled?: boolean
          partial_payment_type?: string
          partial_payment_value?: number | null
          price?: number
          sale_price?: number | null
          sku?: string | null
          slug?: string | null
          stock_quantity?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          is_blocked: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          store_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          store_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link_url: string | null
          store_id: string
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          link_url?: string | null
          store_id: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link_url?: string | null
          store_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_notifications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_pages: {
        Row: {
          content: string | null
          created_at: string
          custom_html: string | null
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          page_type: string
          slug: string | null
          store_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          custom_html?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          page_type?: string
          slug?: string | null
          store_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          custom_html?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          page_type?: string
          slug?: string | null
          store_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_pages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_pages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_payment_config: {
        Row: {
          created_at: string
          id: string
          payment_methods: Json
          razorpay_key_id: string | null
          razorpay_key_secret: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_methods?: Json
          razorpay_key_id?: string | null
          razorpay_key_secret?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_methods?: Json
          razorpay_key_id?: string | null
          razorpay_key_secret?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_plan_assignments: {
        Row: {
          created_at: string
          custom_plan_name: string | null
          custom_price: number | null
          custom_product_limit: number | null
          id: string
          is_free_lifetime: boolean
          is_one_time: boolean
          notes: string | null
          plan_id: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_plan_name?: string | null
          custom_price?: number | null
          custom_product_limit?: number | null
          id?: string
          is_free_lifetime?: boolean
          is_one_time?: boolean
          notes?: string | null
          plan_id: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_plan_name?: string | null
          custom_price?: number | null
          custom_product_limit?: number | null
          id?: string
          is_free_lifetime?: boolean
          is_one_time?: boolean
          notes?: string | null
          plan_id?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_plan_assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_plan_assignments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_plan_assignments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_shipping_config: {
        Row: {
          created_at: string
          flat_rate: number
          free_shipping_above: number | null
          id: string
          is_active: boolean
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          flat_rate?: number
          free_shipping_above?: number | null
          id?: string
          is_active?: boolean
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          flat_rate?: number
          free_shipping_above?: number | null
          id?: string
          is_active?: boolean
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_shipping_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_shipping_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_tax_config: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_inclusive: boolean
          store_id: string
          tax_name: string
          tax_rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_inclusive?: boolean
          store_id: string
          tax_name?: string
          tax_rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_inclusive?: boolean
          store_id?: string
          tax_name?: string
          tax_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_tax_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_tax_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      store_theme_config: {
        Row: {
          accent_color: string
          background_color: string
          body_font: string
          button_style: string
          category_style: string
          created_at: string
          header_logo_alignment: string
          header_style: string
          heading_font: string
          id: string
          marquee_enabled: boolean
          marquee_gradient: string
          marquee_text: string
          mobile_nav_enabled: boolean
          mobile_nav_style: string
          primary_color: string
          product_card_style: string
          store_id: string
          text_color: string
          updated_at: string
        }
        Insert: {
          accent_color?: string
          background_color?: string
          body_font?: string
          button_style?: string
          category_style?: string
          created_at?: string
          header_logo_alignment?: string
          header_style?: string
          heading_font?: string
          id?: string
          marquee_enabled?: boolean
          marquee_gradient?: string
          marquee_text?: string
          mobile_nav_enabled?: boolean
          mobile_nav_style?: string
          primary_color?: string
          product_card_style?: string
          store_id: string
          text_color?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string
          background_color?: string
          body_font?: string
          button_style?: string
          category_style?: string
          created_at?: string
          header_logo_alignment?: string
          header_style?: string
          heading_font?: string
          id?: string
          marquee_enabled?: boolean
          marquee_gradient?: string
          marquee_text?: string
          mobile_nav_enabled?: boolean
          mobile_nav_style?: string
          primary_color?: string
          product_card_style?: string
          store_id?: string
          text_color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_theme_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_theme_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storefront_customers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          about_us_image_url: string | null
          about_us_text: string | null
          banner_url: string | null
          best_selling_carousel: boolean
          business_hours: Json | null
          city: string | null
          created_at: string
          currency: string
          custom_domain: string | null
          default_profit_margin: number | null
          description: string | null
          domain_verification_token: string | null
          domain_verified: boolean | null
          facebook_pixel_id: string | null
          facebook_url: string | null
          features: Json | null
          id: string
          instagram_url: string | null
          is_suspended: boolean
          is_verified: boolean
          location: string | null
          logo_url: string | null
          meta_access_token: string | null
          meta_description: string | null
          meta_title: string | null
          mobile_hero_images: Json | null
          mobile_hero_url: string | null
          name: string
          og_image_url: string | null
          order_mode: string
          owner_email: string | null
          owner_id: string
          partial_payment_enabled: boolean
          partial_payment_type: string
          partial_payment_value: number | null
          return_policy: string | null
          shipping_policy: string | null
          slug: string
          state: string | null
          theme: string
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          about_us_image_url?: string | null
          about_us_text?: string | null
          banner_url?: string | null
          best_selling_carousel?: boolean
          business_hours?: Json | null
          city?: string | null
          created_at?: string
          currency?: string
          custom_domain?: string | null
          default_profit_margin?: number | null
          description?: string | null
          domain_verification_token?: string | null
          domain_verified?: boolean | null
          facebook_pixel_id?: string | null
          facebook_url?: string | null
          features?: Json | null
          id?: string
          instagram_url?: string | null
          is_suspended?: boolean
          is_verified?: boolean
          location?: string | null
          logo_url?: string | null
          meta_access_token?: string | null
          meta_description?: string | null
          meta_title?: string | null
          mobile_hero_images?: Json | null
          mobile_hero_url?: string | null
          name: string
          og_image_url?: string | null
          order_mode?: string
          owner_email?: string | null
          owner_id: string
          partial_payment_enabled?: boolean
          partial_payment_type?: string
          partial_payment_value?: number | null
          return_policy?: string | null
          shipping_policy?: string | null
          slug: string
          state?: string | null
          theme?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          about_us_image_url?: string | null
          about_us_text?: string | null
          banner_url?: string | null
          best_selling_carousel?: boolean
          business_hours?: Json | null
          city?: string | null
          created_at?: string
          currency?: string
          custom_domain?: string | null
          default_profit_margin?: number | null
          description?: string | null
          domain_verification_token?: string | null
          domain_verified?: boolean | null
          facebook_pixel_id?: string | null
          facebook_url?: string | null
          features?: Json | null
          id?: string
          instagram_url?: string | null
          is_suspended?: boolean
          is_verified?: boolean
          location?: string | null
          logo_url?: string | null
          meta_access_token?: string | null
          meta_description?: string | null
          meta_title?: string | null
          mobile_hero_images?: Json | null
          mobile_hero_url?: string | null
          name?: string
          og_image_url?: string | null
          order_mode?: string
          owner_email?: string | null
          owner_id?: string
          partial_payment_enabled?: boolean
          partial_payment_type?: string
          partial_payment_value?: number | null
          return_policy?: string | null
          shipping_policy?: string | null
          slug?: string
          state?: string | null
          theme?: string
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan_id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_bulk_campaigns: {
        Row: {
          admin_campaign: boolean | null
          completed_at: string | null
          created_at: string | null
          failed_count: number | null
          id: string
          message_body: string | null
          recipient_count: number | null
          sent_count: number | null
          status: string | null
          store_id: string
          template_name: string | null
          template_params: Json | null
        }
        Insert: {
          admin_campaign?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          failed_count?: number | null
          id?: string
          message_body?: string | null
          recipient_count?: number | null
          sent_count?: number | null
          status?: string | null
          store_id: string
          template_name?: string | null
          template_params?: Json | null
        }
        Update: {
          admin_campaign?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          failed_count?: number | null
          id?: string
          message_body?: string | null
          recipient_count?: number | null
          sent_count?: number | null
          status?: string | null
          store_id?: string
          template_name?: string | null
          template_params?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_bulk_campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_bulk_campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          access_token: string | null
          business_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          marketing_mode: string
          phone_number_id: string | null
          store_id: string
          updated_at: string
          waba_id: string | null
        }
        Insert: {
          access_token?: string | null
          business_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          marketing_mode?: string
          phone_number_id?: string | null
          store_id: string
          updated_at?: string
          waba_id?: string | null
        }
        Update: {
          access_token?: string | null
          business_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          marketing_mode?: string
          phone_number_id?: string | null
          store_id?: string
          updated_at?: string
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_config_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          abandoned_cart_id: string | null
          created_at: string
          direction: string
          error_message: string | null
          id: string
          media_type: string | null
          media_url: string | null
          message_body: string
          message_type: string
          meta_message_id: string | null
          order_id: string | null
          recipient_name: string | null
          recipient_phone: string
          sender_phone: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          abandoned_cart_id?: string | null
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_body: string
          message_type?: string
          meta_message_id?: string | null
          order_id?: string | null
          recipient_name?: string | null
          recipient_phone: string
          sender_phone?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          abandoned_cart_id?: string | null
          created_at?: string
          direction?: string
          error_message?: string | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_body?: string
          message_type?: string
          meta_message_id?: string | null
          order_id?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          sender_phone?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_abandoned_cart_id_fkey"
            columns: ["abandoned_cart_id"]
            isOneToOne: false
            referencedRelation: "abandoned_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_optouts: {
        Row: {
          id: string
          opted_out_at: string
          phone: string
          reason: string | null
          store_id: string
        }
        Insert: {
          id?: string
          opted_out_at?: string
          phone: string
          reason?: string | null
          store_id: string
        }
        Update: {
          id?: string
          opted_out_at?: string
          phone?: string
          reason?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_optouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_optouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_orders: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          product_id: string | null
          product_name: string
          product_price: number
          quantity: number
          status: string
          store_id: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          product_id?: string | null
          product_name: string
          product_price: number
          quantity?: number
          status?: string
          store_id: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          product_id?: string | null
          product_name?: string
          product_price?: number
          quantity?: number
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_scheduled: {
        Row: {
          created_at: string
          failed_count: number | null
          id: string
          message_body: string
          recipient_phones: Json
          scheduled_at: string
          segment_filter: Json | null
          sent_count: number | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          failed_count?: number | null
          id?: string
          message_body: string
          recipient_phones?: Json
          scheduled_at: string
          segment_filter?: Json | null
          sent_count?: number | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          failed_count?: number | null
          id?: string
          message_body?: string
          recipient_phones?: Json
          scheduled_at?: string
          segment_filter?: Json | null
          sent_count?: number | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_scheduled_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_scheduled_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body_text: string
          created_at: string
          id: string
          is_active: boolean
          language_code: string
          meta_category: string
          meta_rejected_reason: string | null
          meta_status: string
          meta_template_id: string | null
          store_id: string
          template_name: string
          template_type: string
          updated_at: string
        }
        Insert: {
          body_text: string
          created_at?: string
          id?: string
          is_active?: boolean
          language_code?: string
          meta_category?: string
          meta_rejected_reason?: string | null
          meta_status?: string
          meta_template_id?: string | null
          store_id: string
          template_name: string
          template_type?: string
          updated_at?: string
        }
        Update: {
          body_text?: string
          created_at?: string
          id?: string
          is_active?: boolean
          language_code?: string
          meta_category?: string
          meta_rejected_reason?: string | null
          meta_status?: string
          meta_template_id?: string | null
          store_id?: string
          template_name?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_templates_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      store_payment_config_public: {
        Row: {
          created_at: string | null
          id: string | null
          payment_methods: Json | null
          razorpay_key_id: string | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          payment_methods?: Json | null
          razorpay_key_id?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          payment_methods?: Json | null
          razorpay_key_id?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stores_public: {
        Row: {
          banner_url: string | null
          best_selling_carousel: boolean | null
          business_hours: Json | null
          city: string | null
          created_at: string | null
          currency: string | null
          custom_domain: string | null
          description: string | null
          facebook_pixel_id: string | null
          facebook_url: string | null
          features: Json | null
          id: string | null
          instagram_url: string | null
          is_suspended: boolean | null
          is_verified: boolean | null
          location: string | null
          logo_url: string | null
          meta_description: string | null
          meta_title: string | null
          mobile_hero_url: string | null
          name: string | null
          og_image_url: string | null
          order_mode: string | null
          return_policy: string | null
          shipping_policy: string | null
          slug: string | null
          state: string | null
          theme: string | null
          updated_at: string | null
          whatsapp_number: string | null
        }
        Insert: {
          banner_url?: string | null
          best_selling_carousel?: boolean | null
          business_hours?: Json | null
          city?: string | null
          created_at?: string | null
          currency?: string | null
          custom_domain?: string | null
          description?: string | null
          facebook_pixel_id?: string | null
          facebook_url?: string | null
          features?: Json | null
          id?: string | null
          instagram_url?: string | null
          is_suspended?: boolean | null
          is_verified?: boolean | null
          location?: string | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          mobile_hero_url?: string | null
          name?: string | null
          og_image_url?: string | null
          order_mode?: string | null
          return_policy?: string | null
          shipping_policy?: string | null
          slug?: string | null
          state?: string | null
          theme?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          banner_url?: string | null
          best_selling_carousel?: boolean | null
          business_hours?: Json | null
          city?: string | null
          created_at?: string | null
          currency?: string | null
          custom_domain?: string | null
          description?: string | null
          facebook_pixel_id?: string | null
          facebook_url?: string | null
          features?: Json | null
          id?: string | null
          instagram_url?: string | null
          is_suspended?: boolean | null
          is_verified?: boolean | null
          location?: string | null
          logo_url?: string | null
          meta_description?: string | null
          meta_title?: string | null
          mobile_hero_url?: string | null
          name?: string | null
          og_image_url?: string | null
          order_mode?: string | null
          return_policy?: string | null
          shipping_policy?: string | null
          slug?: string | null
          state?: string | null
          theme?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_create_website_order: {
        Args: { _store_id: string }
        Returns: boolean
      }
      can_create_website_order_item: {
        Args: { _order_id: string }
        Returns: boolean
      }
      check_product_limit: { Args: { _user_id: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_admin_analytics: { Args: never; Returns: Json }
      get_admin_stats: { Args: never; Returns: Json }
      get_admin_users_stores: { Args: never; Returns: Json }
      get_co_purchased_products: {
        Args: { _limit?: number; _product_id: string }
        Returns: string[]
      }
      get_own_domain_token: { Args: { _store_id: string }; Returns: string }
      get_own_payment_secret: { Args: { _store_id: string }; Returns: string }
      get_own_store_meta_token: { Args: { _store_id: string }; Returns: string }
      get_platform_config_public: {
        Args: never
        Returns: {
          default_currency: string
          id: string
          platform_name: string
        }[]
      }
      get_store_payment_config: { Args: { _store_id: string }; Returns: Json }
      get_store_public_email: { Args: { _store_id: string }; Returns: string }
      get_store_usage_stats: { Args: never; Returns: Json }
      get_store_views: {
        Args: { _store_ids: string[] }
        Returns: {
          store_id: string
          view_count: number
        }[]
      }
      get_storefront_data:
        | { Args: { _slug: string }; Returns: Json }
        | { Args: { _product_limit?: number; _slug: string }; Returns: Json }
      get_storefront_shell: { Args: { _slug: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_order_owner: { Args: { _order_id: string }; Returns: boolean }
      is_store_active: { Args: { _store_id: string }; Returns: boolean }
      is_store_owner: { Args: { _store_id: string }; Returns: boolean }
      is_storefront_customer: {
        Args: { _customer_id: string }
        Returns: boolean
      }
      is_user_blocked: { Args: never; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
