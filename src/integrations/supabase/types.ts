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
      activities: {
        Row: {
          body: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          id: string
          owner_id: string | null
          subject: string
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          body?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          owner_id?: string | null
          subject: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          body?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          owner_id?: string | null
          subject?: string
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          slot_end: string
          slot_start: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          slot_end: string
          slot_start: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          slot_end?: string
          slot_start?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          first_visit: string | null
          id: string
          ig_handle: string | null
          last_visit: string | null
          lifetime_spend_cents: number
          name: string
          notes: string | null
          owner_id: string | null
          phone: string | null
          relationship_status: string | null
          source: string
          tags: string[]
          transaction_count: number
          type: Database["public"]["Enums"]["contact_type"]
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          first_visit?: string | null
          id?: string
          ig_handle?: string | null
          last_visit?: string | null
          lifetime_spend_cents?: number
          name: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          relationship_status?: string | null
          source?: string
          tags?: string[]
          transaction_count?: number
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          first_visit?: string | null
          id?: string
          ig_handle?: string | null
          last_visit?: string | null
          lifetime_spend_cents?: number
          name?: string
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          relationship_status?: string | null
          source?: string
          tags?: string[]
          transaction_count?: number
          type?: Database["public"]["Enums"]["contact_type"]
          updated_at?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          contact_id: string | null
          created_at: string
          expected_close: string | null
          id: string
          notes: string | null
          owner_id: string | null
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          expected_close?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          expected_close?: string | null
          id?: string
          notes?: string | null
          owner_id?: string | null
          stage?: Database["public"]["Enums"]["deal_stage"]
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_completions: {
        Row: {
          completed_at: string
          doc_id: string
          id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          doc_id: string
          id?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          doc_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doc_completions_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "docs"
            referencedColumns: ["id"]
          },
        ]
      }
      docs: {
        Row: {
          category: string
          content: string | null
          created_at: string
          created_by: string | null
          file_url: string | null
          id: string
          is_required: boolean
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          is_required?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          file_url?: string | null
          id?: string
          is_required?: boolean
          title?: string
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
      ig_threads: {
        Row: {
          commenter: boolean
          contact_id: string | null
          created_at: string
          follows_us: boolean
          handle: string
          has_dm_history: boolean
          id: string
          is_follower: boolean
          key_topics: string | null
          last_message_date: string | null
          notes: string | null
          pending_request: boolean
          profile_link: string | null
          snippet: string | null
          status: string | null
          their_replies: number
          total_messages: number
          updated_at: string
        }
        Insert: {
          commenter?: boolean
          contact_id?: string | null
          created_at?: string
          follows_us?: boolean
          handle: string
          has_dm_history?: boolean
          id?: string
          is_follower?: boolean
          key_topics?: string | null
          last_message_date?: string | null
          notes?: string | null
          pending_request?: boolean
          profile_link?: string | null
          snippet?: string | null
          status?: string | null
          their_replies?: number
          total_messages?: number
          updated_at?: string
        }
        Update: {
          commenter?: boolean
          contact_id?: string | null
          created_at?: string
          follows_us?: boolean
          handle?: string
          has_dm_history?: boolean
          id?: string
          is_follower?: boolean
          key_topics?: string | null
          last_message_date?: string | null
          notes?: string | null
          pending_request?: boolean
          profile_link?: string | null
          snippet?: string | null
          status?: string | null
          their_replies?: number
          total_messages?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ig_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_requests: {
        Row: {
          cart: Json
          contact_email: string
          contact_name: string
          contact_phone: string | null
          contract_accepted: boolean
          contract_accepted_at: string | null
          created_at: string
          deposit_cents: number
          id: string
          message: string | null
          package_id: string | null
          paid_at: string | null
          project_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subscribe_monthly: boolean
          total_cents: number
          updated_at: string
        }
        Insert: {
          cart?: Json
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          contract_accepted?: boolean
          contract_accepted_at?: string | null
          created_at?: string
          deposit_cents?: number
          id?: string
          message?: string | null
          package_id?: string | null
          paid_at?: string | null
          project_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subscribe_monthly?: boolean
          total_cents?: number
          updated_at?: string
        }
        Update: {
          cart?: Json
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          contract_accepted?: boolean
          contract_accepted_at?: string | null
          created_at?: string
          deposit_cents?: number
          id?: string
          message?: string | null
          package_id?: string | null
          paid_at?: string | null
          project_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subscribe_monthly?: boolean
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intake_requests_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      message_channels: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          author_id: string | null
          body: string
          channel_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          channel_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          channel_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "message_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          label: string
          pay_date: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          label: string
          pay_date: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          label?: string
          pay_date?: string
          start_date?: string
        }
        Relationships: []
      }
      pay_stubs: {
        Row: {
          breakdown: Json
          created_at: string
          expense_cents: number
          file_url: string | null
          flat_cents: number
          gross_amount: number
          hourly_cents: number
          id: string
          net_amount: number
          notes: string | null
          paid_at: string | null
          paid_method: string | null
          paid_reference: string | null
          pay_period_id: string | null
          revshare_cents: number
          timesheet_period_id: string | null
          user_id: string
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          expense_cents?: number
          file_url?: string | null
          flat_cents?: number
          gross_amount?: number
          hourly_cents?: number
          id?: string
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          paid_method?: string | null
          paid_reference?: string | null
          pay_period_id?: string | null
          revshare_cents?: number
          timesheet_period_id?: string | null
          user_id: string
        }
        Update: {
          breakdown?: Json
          created_at?: string
          expense_cents?: number
          file_url?: string | null
          flat_cents?: number
          gross_amount?: number
          hourly_cents?: number
          id?: string
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          paid_method?: string | null
          paid_reference?: string | null
          pay_period_id?: string | null
          revshare_cents?: number
          timesheet_period_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_stubs_pay_period_id_fkey"
            columns: ["pay_period_id"]
            isOneToOne: false
            referencedRelation: "pay_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_employment_history: {
        Row: {
          created_at: string
          created_by: string | null
          department: Database["public"]["Enums"]["department"] | null
          ended_at: string | null
          id: string
          job_title: string | null
          notes: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["department"] | null
          ended_at?: string | null
          id?: string
          job_title?: string | null
          notes?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: Database["public"]["Enums"]["department"] | null
          ended_at?: string | null
          id?: string
          job_title?: string | null
          notes?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          alias: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          date_of_birth: string | null
          department: Database["public"]["Enums"]["department"] | null
          display_name: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          employment_notes: string | null
          employment_status: string
          ended_at: string | null
          hourly_rate_cents: number
          id: string
          internal_notes: string | null
          job_title: string | null
          payment_method: string | null
          phone: string | null
          portfolio_url: string | null
          program: string | null
          pronouns: string | null
          specialty: string | null
          stage_name: string | null
          started_at: string | null
          updated_at: string
          wage: string | null
          website: string | null
          work_type: string | null
        }
        Insert: {
          address?: string | null
          alias?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: Database["public"]["Enums"]["department"] | null
          display_name?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employment_notes?: string | null
          employment_status?: string
          ended_at?: string | null
          hourly_rate_cents?: number
          id: string
          internal_notes?: string | null
          job_title?: string | null
          payment_method?: string | null
          phone?: string | null
          portfolio_url?: string | null
          program?: string | null
          pronouns?: string | null
          specialty?: string | null
          stage_name?: string | null
          started_at?: string | null
          updated_at?: string
          wage?: string | null
          website?: string | null
          work_type?: string | null
        }
        Update: {
          address?: string | null
          alias?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: Database["public"]["Enums"]["department"] | null
          display_name?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          employment_notes?: string | null
          employment_status?: string
          ended_at?: string | null
          hourly_rate_cents?: number
          id?: string
          internal_notes?: string | null
          job_title?: string | null
          payment_method?: string | null
          phone?: string | null
          portfolio_url?: string | null
          program?: string | null
          pronouns?: string | null
          specialty?: string | null
          stage_name?: string | null
          started_at?: string | null
          updated_at?: string
          wage?: string | null
          website?: string | null
          work_type?: string | null
        }
        Relationships: []
      }
      project_allocations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          project_id: string
          role_label: string | null
          share_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id: string
          role_label?: string | null
          share_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          role_label?: string | null
          share_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_clients: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_clients_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_line_items: {
        Row: {
          base_amount_cents: number
          booking_date: string | null
          created_at: string
          created_by: string | null
          credits_used: number
          debit_kind: string
          deliverable: string
          description: string | null
          discount_cents: number
          grand_total_cents: number
          id: string
          location: string | null
          payment_method: string | null
          project_id: string
          session_hours: number | null
          status: string
          updated_at: string
        }
        Insert: {
          base_amount_cents?: number
          booking_date?: string | null
          created_at?: string
          created_by?: string | null
          credits_used?: number
          debit_kind?: string
          deliverable: string
          description?: string | null
          discount_cents?: number
          grand_total_cents?: number
          id?: string
          location?: string | null
          payment_method?: string | null
          project_id: string
          session_hours?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          base_amount_cents?: number
          booking_date?: string | null
          created_at?: string
          created_by?: string | null
          credits_used?: number
          debit_kind?: string
          deliverable?: string
          description?: string | null
          discount_cents?: number
          grand_total_cents?: number
          id?: string
          location?: string | null
          payment_method?: string | null
          project_id?: string
          session_hours?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_line_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          approved_at: string | null
          created_at: string
          created_by: string | null
          credit_cost: number
          description: string | null
          due_date: string | null
          id: string
          project_id: string
          sort_order: number
          status: Database["public"]["Enums"]["milestone_status"]
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          credit_cost?: number
          description?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          sort_order?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          credit_cost?: number
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["milestone_status"]
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_payments: {
        Row: {
          amount_cents: number
          created_at: string
          due_date: string | null
          id: string
          kind: string
          label: string
          method: string | null
          notes: string | null
          paid_date: string | null
          project_id: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          due_date?: string | null
          id?: string
          kind?: string
          label: string
          method?: string | null
          notes?: string | null
          paid_date?: string | null
          project_id: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          due_date?: string | null
          id?: string
          kind?: string
          label?: string
          method?: string | null
          notes?: string | null
          paid_date?: string | null
          project_id?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          active_tier_slug: string | null
          archived_at: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          credit_balance: number
          dollar_balance_cents: number
          id: string
          intake_estimate_cents: number
          notes: string | null
          owner_id: string | null
          package_id: string | null
          paused_at: string | null
          pending_change_at: string | null
          pending_tier_slug: string | null
          project_code: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active_tier_slug?: string | null
          archived_at?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          credit_balance?: number
          dollar_balance_cents?: number
          id?: string
          intake_estimate_cents?: number
          notes?: string | null
          owner_id?: string | null
          package_id?: string | null
          paused_at?: string | null
          pending_change_at?: string | null
          pending_tier_slug?: string | null
          project_code?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active_tier_slug?: string | null
          archived_at?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          credit_balance?: number
          dollar_balance_cents?: number
          id?: string
          intake_estimate_cents?: number
          notes?: string | null
          owner_id?: string | null
          package_id?: string | null
          paused_at?: string | null
          pending_change_at?: string | null
          pending_tier_slug?: string | null
          project_code?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "service_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          note: string | null
          role: Database["public"]["Enums"]["app_role"]
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          uses?: number
        }
        Relationships: []
      }
      service_packages: {
        Row: {
          billing_interval: string | null
          category: string | null
          created_at: string
          credits: number
          credits_cost: number
          description: string | null
          id: string
          is_active: boolean
          kind: string
          min_quantity: number
          name: string
          price_cents: number
          slug: string
          sort_order: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          billing_interval?: string | null
          category?: string | null
          created_at?: string
          credits?: number
          credits_cost?: number
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          min_quantity?: number
          name: string
          price_cents?: number
          slug: string
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?: string | null
          category?: string | null
          created_at?: string
          credits?: number
          credits_cost?: number
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          min_quantity?: number
          name?: string
          price_cents?: number
          slug?: string
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          pending_price_id: string | null
          price_id: string
          product_id: string
          project_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          pending_price_id?: string | null
          price_id: string
          product_id: string
          project_id?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          pending_price_id?: string | null
          price_id?: string
          product_id?: string
          project_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      tasks: {
        Row: {
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          important: boolean
          notes: string | null
          owner_id: string
          title: string
          updated_at: string
          urgent: boolean
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          important?: boolean
          notes?: string | null
          owner_id: string
          title: string
          updated_at?: string
          urgent?: boolean
        }
        Update: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          important?: boolean
          notes?: string | null
          owner_id?: string
          title?: string
          updated_at?: string
          urgent?: boolean
        }
        Relationships: []
      }
      team_availability: {
        Row: {
          created_at: string
          days: string[]
          id: string
          notes: string | null
          slots: string[]
          time_blocks: string[]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days?: string[]
          id?: string
          notes?: string | null
          slots?: string[]
          time_blocks?: string[]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: string[]
          id?: string
          notes?: string | null
          slots?: string[]
          time_blocks?: string[]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          email: string
          id: string
          invited_at: string
          invited_by: string | null
          note: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invite_status"]
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          email: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string | null
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invite_status"]
          user_id?: string | null
        }
        Relationships: []
      }
      timesheet_entries: {
        Row: {
          created_at: string
          day: string | null
          deliverable: string
          end_time: string | null
          expense_cents: number
          hours: number
          id: string
          notes: string | null
          project_id: string | null
          rate_amount_cents: number
          start_time: string | null
          timesheet_id: string
          work_type: string
        }
        Insert: {
          created_at?: string
          day?: string | null
          deliverable: string
          end_time?: string | null
          expense_cents?: number
          hours?: number
          id?: string
          notes?: string | null
          project_id?: string | null
          rate_amount_cents?: number
          start_time?: string | null
          timesheet_id: string
          work_type?: string
        }
        Update: {
          created_at?: string
          day?: string | null
          deliverable?: string
          end_time?: string | null
          expense_cents?: number
          hours?: number
          id?: string
          notes?: string | null
          project_id?: string | null
          rate_amount_cents?: number
          start_time?: string | null
          timesheet_id?: string
          work_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_timesheet_id_fkey"
            columns: ["timesheet_id"]
            isOneToOne: false
            referencedRelation: "timesheets"
            referencedColumns: ["id"]
          },
        ]
      }
      timesheet_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          is_open: boolean
          label: string
          pay_date: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          is_open?: boolean
          label: string
          pay_date: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          is_open?: boolean
          label?: string
          pay_date?: string
          start_date?: string
        }
        Relationships: []
      }
      timesheets: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          next_period_goals: string | null
          notes: string | null
          period_id: string
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
          work_summary: string | null
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          next_period_goals?: string | null
          notes?: string | null
          period_id: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          work_summary?: string | null
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          next_period_goals?: string | null
          notes?: string | null
          period_id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          work_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "timesheet_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_pending_tier_change: {
        Args: { _subscription_id: string }
        Returns: undefined
      }
      apply_tier_credits: {
        Args: { _project_id: string; _tier_slug: string }
        Returns: undefined
      }
      archive_expired_projects: { Args: never; Returns: number }
      consume_referral_code: {
        Args: { _code: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      create_project_from_intake: {
        Args: { _intake_id: string }
        Returns: string
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_checkout_outcome: {
        Args: { _session_id: string }
        Returns: {
          contact_email: string
          kind: string
          project_code: string
          project_id: string
        }[]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: { Args: { _user_id: string }; Returns: boolean }
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
      redeem_project_code: { Args: { _code: string }; Returns: string }
      validate_referral_code: {
        Args: { _code: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      activity_type: "call" | "email" | "meeting" | "note" | "task"
      app_role: "admin" | "employee" | "client"
      contact_type: "lead" | "client" | "partner" | "vendor"
      deal_stage:
        | "lead"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      department: "marketing" | "hr" | "development" | "sales" | "operations"
      invite_status: "pending" | "accepted" | "revoked"
      milestone_status: "pending" | "submitted" | "approved" | "cancelled"
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
      activity_type: ["call", "email", "meeting", "note", "task"],
      app_role: ["admin", "employee", "client"],
      contact_type: ["lead", "client", "partner", "vendor"],
      deal_stage: [
        "lead",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      department: ["marketing", "hr", "development", "sales", "operations"],
      invite_status: ["pending", "accepted", "revoked"],
      milestone_status: ["pending", "submitted", "approved", "cancelled"],
    },
  },
} as const
