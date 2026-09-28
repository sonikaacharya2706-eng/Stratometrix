import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type UserRole = 'forecaster' | 'user';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Region {
  id: string;
  name: string;
  code: string;
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
  description: string;
  created_at: string;
}

export interface Forecast {
  id: string;
  model_source: 'GFS' | 'ECMWF' | 'ICON' | 'UKMO';
  init_time: string;
  run_cycle: string;
  notes: string;
  created_by: string | null;
  created_at: string;
}

export interface ConfidenceScore {
  id: string;
  forecast_id: string;
  region_id: string;
  day_horizon: number;
  confidence_pct: number;
  roc_auc: number | null;
  brier_score: number | null;
  false_alarm_rate: number | null;
  temperature_anomaly: number | null;
  precipitation_anomaly: number | null;
  pressure_anomaly: number | null;
  created_at: string;
}

export interface BustProbability {
  id: string;
  forecast_id: string;
  region_id: string;
  day_horizon: number;
  bust_probability: number;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  failure_description: string;
  created_at: string;
}

export interface DriverAttribution {
  id: string;
  forecast_id: string;
  region_id: string;
  day_horizon: number;
  parameter_name: string;
  attribution_score: number;
  anomaly_value: number | null;
  description: string;
  created_at: string;
}

export interface Alert {
  id: string;
  forecast_id: string | null;
  region_id: string | null;
  alert_type: 'bust_risk' | 'low_confidence' | 'system' | 'data_ingestion';
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  message: string;
  channel: 'app' | 'sms' | 'webhook';
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}
