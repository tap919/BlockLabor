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
      branches: {
        Row: {
          active_jobs_count: number | null
          active_workers_count: number | null
          city: string
          id: string
          manager: string
          margin_target: number | null
          name: string
        }
        Insert: {
          active_jobs_count?: number | null
          active_workers_count?: number | null
          city: string
          id?: string
          manager: string
          margin_target?: number | null
          name: string
        }
        Update: {
          active_jobs_count?: number | null
          active_workers_count?: number | null
          city?: string
          id?: string
          manager?: string
          margin_target?: number | null
          name?: string
        }
      }
      candidates: {
        Row: {
          attendance_rate: number | null
          background_check_status: string | null
          branch_name: string | null
          client_rating_class: string | null
          completion_rate: number | null
          created_at: string | null
          e_sign_status: string | null
          email: string
          id: string
          is_redeployed: boolean | null
          name: string
          no_show_count: number | null
          pay_option: string | null
          performance_score: number | null
          phone: string | null
          profile_updated: boolean | null
          punctuality_rate: number | null
          recruiter_name: string | null
          reliability_score: number | null
          skills: string[] | null
          state_code: string | null
          status: string | null
          time_to_onboard_days: number | null
          total_earned: number | null
          vendor_id: string | null
          verified_credentials: string[] | null
          verticals: string[] | null
        }
        Insert: {
          attendance_rate?: number | null
          background_check_status?: string | null
          branch_name?: string | null
          client_rating_class?: string | null
          completion_rate?: number | null
          created_at?: string | null
          e_sign_status?: string | null
          email: string
          id?: string
          is_redeployed?: boolean | null
          name: string
          no_show_count?: number | null
          pay_option?: string | null
          performance_score?: number | null
          phone?: string | null
          profile_updated?: boolean | null
          punctuality_rate?: number | null
          recruiter_name?: string | null
          reliability_score?: number | null
          skills?: string[] | null
          state_code?: string | null
          status?: string | null
          time_to_onboard_days?: number | null
          total_earned?: number | null
          vendor_id?: string | null
          verified_credentials?: string[] | null
          verticals?: string[] | null
        }
        Update: {
          attendance_rate?: number | null
          background_check_status?: string | null
          branch_name?: string | null
          client_rating_class?: string | null
          completion_rate?: number | null
          created_at?: string | null
          e_sign_status?: string | null
          email?: string
          id?: string
          is_redeployed?: boolean | null
          name?: string
          no_show_count?: number | null
          pay_option?: string | null
          performance_score?: number | null
          phone?: string | null
          profile_updated?: boolean | null
          punctuality_rate?: number | null
          recruiter_name?: string | null
          reliability_score?: number | null
          skills?: string[] | null
          state_code?: string | null
          status?: string | null
          time_to_onboard_days?: number | null
          total_earned?: number | null
          vendor_id?: string | null
          verified_credentials?: string[] | null
          verticals?: string[] | null
        }
      }
      incident_reports: {
        Row: {
          business_name: string
          category: string | null
          contractor_id: string | null
          contractor_name: string | null
          created_at: string | null
          description: string | null
          id: string
          job_id: string | null
          reported_by: string | null
          resolution_notes: string | null
          severity: string | null
          status: string | null
        }
        Insert: {
          business_name: string
          category?: string | null
          contractor_id?: string | null
          contractor_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          severity?: string | null
          status?: string | null
        }
        Update: {
          business_name?: string
          category?: string | null
          contractor_id?: string | null
          contractor_name?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          reported_by?: string | null
          resolution_notes?: string | null
          severity?: string | null
          status?: string | null
        }
      }
      integrations: {
        Row: {
          api_key: string | null
          category: string | null
          id: string
          last_sync: string | null
          name: string
          status: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          category?: string | null
          id?: string
          last_sync?: string | null
          name: string
          status?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          category?: string | null
          id?: string
          last_sync?: string | null
          name?: string
          status?: string | null
          webhook_url?: string | null
        }
      }
      jobs: {
        Row: {
          bill_rate: number | null
          block_type: string
          branch_id: string | null
          branch_name: string | null
          business_name: string
          category: string
          charge: number | null
          contractor_id: string | null
          created_at: string | null
          drop_requested: boolean | null
          duration_shifts: number | null
          headcount: number | null
          hours_per_shift: number | null
          id: string
          incidents_count: number | null
          invoice_adjustment_notes: string | null
          invoice_amount_adjusted: number | null
          invoice_term_days: number | null
          is_outsourced: boolean | null
          location: string | null
          location_name: string | null
          markup: number | null
          overtime_hours: number | null
          pay_rate: number | null
          payout: number | null
          payroll_deductions: number | null
          payroll_expenses: number | null
          recruiter_id: string | null
          recruiter_name: string | null
          required_skills: string[] | null
          shift_end_time: string | null
          shift_hours: number | null
          shift_start_time: string | null
          start_window: string | null
          state_code: string | null
          status: string
          swap_requested: boolean | null
          timesheet_verified_at: string | null
          vendor_id: string | null
          vendor_name: string | null
          vertical: string
        }
        Insert: {
          bill_rate?: number | null
          block_type: string
          branch_id?: string | null
          branch_name?: string | null
          business_name: string
          category: string
          charge?: number | null
          contractor_id?: string | null
          created_at?: string | null
          drop_requested?: boolean | null
          duration_shifts?: number | null
          headcount?: number | null
          hours_per_shift?: number | null
          id?: string
          incidents_count?: number | null
          invoice_adjustment_notes?: string | null
          invoice_amount_adjusted?: number | null
          invoice_term_days?: number | null
          is_outsourced?: boolean | null
          location?: string | null
          location_name?: string | null
          markup?: number | null
          overtime_hours?: number | null
          pay_rate?: number | null
          payout?: number | null
          payroll_deductions?: number | null
          payroll_expenses?: number | null
          recruiter_id?: string | null
          recruiter_name?: string | null
          required_skills?: string[] | null
          shift_end_time?: string | null
          shift_hours?: number | null
          shift_start_time?: string | null
          start_window?: string | null
          state_code?: string | null
          status?: string
          swap_requested?: boolean | null
          timesheet_verified_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
          vertical: string
        }
        Update: {
          bill_rate?: number | null
          block_type?: string
          branch_id?: string | null
          branch_name?: string | null
          business_name?: string
          category?: string
          charge?: number | null
          contractor_id?: string | null
          created_at?: string | null
          drop_requested?: boolean | null
          duration_shifts?: number | null
          headcount?: number | null
          hours_per_shift?: number | null
          id?: string
          incidents_count?: number | null
          invoice_adjustment_notes?: string | null
          invoice_amount_adjusted?: number | null
          invoice_term_days?: number | null
          is_outsourced?: boolean | null
          location?: string | null
          location_name?: string | null
          markup?: number | null
          overtime_hours?: number | null
          pay_rate?: number | null
          payout?: number | null
          payroll_deductions?: number | null
          payroll_expenses?: number | null
          recruiter_id?: string | null
          recruiter_name?: string | null
          required_skills?: string[] | null
          shift_end_time?: string | null
          shift_hours?: number | null
          shift_start_time?: string | null
          start_window?: string | null
          state_code?: string | null
          status?: string
          swap_requested?: boolean | null
          timesheet_verified_at?: string | null
          vendor_id?: string | null
          vendor_name?: string | null
          vertical?: string
        }
      }
      partner_vendors: {
        Row: {
          assigned_jobs_count: number | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          insurance_expiry: string | null
          markup_share: number | null
          name: string
          phone: string | null
          status: string | null
          tax_id: string | null
          verticals: string[] | null
        }
        Insert: {
          assigned_jobs_count?: number | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          insurance_expiry?: string | null
          markup_share?: number | null
          name: string
          phone?: string | null
          status?: string | null
          tax_id?: string | null
          verticals?: string[] | null
        }
        Update: {
          assigned_jobs_count?: number | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          insurance_expiry?: string | null
          markup_share?: number | null
          name?: string
          phone?: string | null
          status?: string | null
          tax_id?: string | null
          verticals?: string[] | null
        }
      }
      rate_cards: {
        Row: {
          category: string
          custom_client_markup_percent: number
          id: string
          standard_bill_rate: number
          standard_pay_rate: number
          vertical: string
        }
        Insert: {
          category: string
          custom_client_markup_percent: number
          id?: string
          standard_bill_rate: number
          standard_pay_rate: number
          vertical: string
        }
        Update: {
          category?: string
          custom_client_markup_percent?: number
          id?: string
          standard_bill_rate?: number
          standard_pay_rate?: number
          vertical?: string
        }
      }
      sso_config: {
        Row: {
          active_directory_group: string | null
          domain: string | null
          enabled: boolean | null
          id: string
          last_sync_date: string | null
          provider: string | null
        }
        Insert: {
          active_directory_group?: string | null
          domain?: string | null
          enabled?: boolean | null
          id?: string
          last_sync_date?: string | null
          provider?: string | null
        }
        Update: {
          active_directory_group?: string | null
          domain?: string | null
          enabled?: boolean | null
          id?: string
          last_sync_date?: string | null
          provider?: string | null
        }
      }
      system_logs: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          message: string
          type: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          message: string
          type?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          message?: string
          type?: string | null
        }
      }
      users: {
        Row: {
          branch_id: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id?: string
          role: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: string
        }
      }
    }
  }
}
