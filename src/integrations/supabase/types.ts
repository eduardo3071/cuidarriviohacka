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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      access_log: {
        Row: {
          accessed_at: string
          action: string
          category: string
          doctor_id: string
          id: number
          patient_id: string
        }
        Insert: {
          accessed_at?: string
          action?: string
          category: string
          doctor_id: string
          id?: never
          patient_id: string
        }
        Update: {
          accessed_at?: string
          action?: string
          category?: string
          doctor_id?: string
          id?: never
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_log_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_log_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          dedupe_key: string | null
          evidence: Json
          id: string
          kind: string
          message: string
          patient_id: string
          rule_version: number
          severity: string
          title: string | null
          triggered_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          dedupe_key?: string | null
          evidence?: Json
          id?: string
          kind: string
          message: string
          patient_id: string
          rule_version?: number
          severity: string
          title?: string | null
          triggered_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          dedupe_key?: string | null
          evidence?: Json
          id?: string
          kind?: string
          message?: string
          patient_id?: string
          rule_version?: number
          severity?: string
          title?: string | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      biomarker_aliases: {
        Row: {
          alias_normalized: string
          biomarker_id: string
        }
        Insert: {
          alias_normalized: string
          biomarker_id: string
        }
        Update: {
          alias_normalized?: string
          biomarker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "biomarker_aliases_biomarker_id_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
        ]
      }
      biomarkers: {
        Row: {
          canonical_name: string
          category: string | null
          id: string
          unit_canonical: string
        }
        Insert: {
          canonical_name: string
          category?: string | null
          id?: string
          unit_canonical: string
        }
        Update: {
          canonical_name?: string
          category?: string | null
          id?: string
          unit_canonical?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          categories: string[]
          doctor_id: string
          expires_at: string
          granted_at: string
          id: string
          patient_id: string
          revoked_at: string | null
        }
        Insert: {
          categories: string[]
          doctor_id: string
          expires_at: string
          granted_at?: string
          id?: string
          patient_id: string
          revoked_at?: string | null
        }
        Update: {
          categories?: string[]
          doctor_id?: string
          expires_at?: string
          granted_at?: string
          id?: string
          patient_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          created_at: string
          crm: string | null
          full_name: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          crm?: string | null
          full_name: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          crm?: string | null
          full_name?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          collected_at: string | null
          created_at: string
          extraction_method: string | null
          id: string
          lab_name: string | null
          mime_type: string
          page_paths: string[]
          patient_id: string
          sha256: string
          status: string
          storage_path: string
        }
        Insert: {
          collected_at?: string | null
          created_at?: string
          extraction_method?: string | null
          id?: string
          lab_name?: string | null
          mime_type: string
          page_paths?: string[]
          patient_id: string
          sha256: string
          status?: string
          storage_path: string
        }
        Update: {
          collected_at?: string | null
          created_at?: string
          extraction_method?: string | null
          id?: string
          lab_name?: string | null
          mime_type?: string
          page_paths?: string[]
          patient_id?: string
          sha256?: string
          status?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      encounters: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          occurred_at: string
          patient_id: string
          provider: string | null
          specialty: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          occurred_at: string
          patient_id: string
          provider?: string | null
          specialty?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          occurred_at?: string
          patient_id?: string
          provider?: string | null
          specialty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounters_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          document_id: string | null
          error: string | null
          error_code: string | null
          id: string
          kind: string
          patient_id: string
          result: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          error?: string | null
          error_code?: string | null
          id?: string
          kind?: string
          patient_id: string
          result?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          error?: string | null
          error_code?: string | null
          id?: string
          kind?: string
          patient_id?: string
          result?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          dose: string | null
          ended_at: string | null
          id: string
          name: string
          patient_id: string
          started_at: string | null
        }
        Insert: {
          created_at?: string
          dose?: string | null
          ended_at?: string | null
          id?: string
          name: string
          patient_id: string
          started_at?: string | null
        }
        Update: {
          created_at?: string
          dose?: string | null
          ended_at?: string | null
          id?: string
          name?: string
          patient_id?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      observations: {
        Row: {
          biomarker_id: string | null
          collected_at: string
          confidence: number | null
          created_at: string
          document_id: string | null
          extraction_method: string | null
          extraction_notes: string[]
          id: string
          lab_name: string | null
          patient_id: string
          raw_name: string
          ref_high: number | null
          ref_low: number | null
          ref_text: string | null
          source_bbox: Json | null
          source_page: number | null
          status: string
          unit: string | null
          value: number
        }
        Insert: {
          biomarker_id?: string | null
          collected_at: string
          confidence?: number | null
          created_at?: string
          document_id?: string | null
          extraction_method?: string | null
          extraction_notes?: string[]
          id?: string
          lab_name?: string | null
          patient_id: string
          raw_name: string
          ref_high?: number | null
          ref_low?: number | null
          ref_text?: string | null
          source_bbox?: Json | null
          source_page?: number | null
          status?: string
          unit?: string | null
          value: number
        }
        Update: {
          biomarker_id?: string | null
          collected_at?: string
          confidence?: number | null
          created_at?: string
          document_id?: string | null
          extraction_method?: string | null
          extraction_notes?: string[]
          id?: string
          lab_name?: string | null
          patient_id?: string
          raw_name?: string
          ref_high?: number | null
          ref_low?: number | null
          ref_text?: string | null
          source_bbox?: Json | null
          source_page?: number | null
          status?: string
          unit?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "observations_biomarker_id_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          birth_date: string | null
          created_at: string
          full_name: string
          id: string
          sex: string | null
          user_id: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          full_name: string
          id?: string
          sex?: string | null
          user_id?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          full_name?: string
          id?: string
          sex?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      unit_conversions: {
        Row: {
          biomarker_id: string
          factor: number
          from_unit: string
          id: string
          offset: number
          to_unit: string
        }
        Insert: {
          biomarker_id: string
          factor: number
          from_unit: string
          id?: string
          offset?: number
          to_unit: string
        }
        Update: {
          biomarker_id?: string
          factor?: number
          from_unit?: string
          id?: string
          offset?: number
          to_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_conversions_biomarker_id_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccinations: {
        Row: {
          administered_at: string
          created_at: string
          dose_number: number | null
          id: string
          name: string
          patient_id: string
        }
        Insert: {
          administered_at: string
          created_at?: string
          dose_number?: number | null
          id?: string
          name: string
          patient_id: string
        }
        Update: {
          administered_at?: string
          created_at?: string
          dose_number?: number | null
          id?: string
          name?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccinations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      wearable_samples: {
        Row: {
          id: number
          metric: string
          patient_id: string
          recorded_at: string
          source: string
          unit: string | null
          value: number
        }
        Insert: {
          id?: never
          metric: string
          patient_id: string
          recorded_at: string
          source?: string
          unit?: string | null
          value: number
        }
        Update: {
          id?: never
          metric?: string
          patient_id?: string
          recorded_at?: string
          source?: string
          unit?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "wearable_samples_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      observation_series: {
        Row: {
          biomarker: string | null
          biomarker_id: string | null
          category: string | null
          collected_at: string | null
          confidence: number | null
          document_id: string | null
          extraction_method: string | null
          flag: string | null
          lab_name: string | null
          normalization: string | null
          observation_id: string | null
          patient_id: string | null
          raw_name: string | null
          raw_ref_high: number | null
          raw_ref_low: number | null
          raw_unit: string | null
          raw_value: number | null
          ref_high: number | null
          ref_low: number | null
          ref_text: string | null
          unit_canonical: string | null
          value: number | null
        }
        Relationships: [
          {
            foreignKeyName: "observations_biomarker_id_fkey"
            columns: ["biomarker_id"]
            isOneToOne: false
            referencedRelation: "biomarkers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          detail: Json | null
          event_date: string | null
          kind: string | null
          patient_id: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      confirm_document: {
        Args: {
          p_collected_at: string
          p_document: string
          p_lab_name: string
          p_observations: Json
          p_patient: string
        }
        Returns: Json
      }
      create_document_once: {
        Args: {
          p_mime: string
          p_patient: string
          p_sha256: string
          p_storage_path: string
        }
        Returns: {
          out_document_id: string
          out_is_new: boolean
          out_job_id: string
          out_status: string
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
    Enums: {},
  },
} as const
