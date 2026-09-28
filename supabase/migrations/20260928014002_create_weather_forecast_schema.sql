/*
# Weather Forecast Confidence & Bust Probability Platform — Schema

## Overview
Creates the full database schema for a meteorological forecast confidence mapping
and bust probability engine. Supports multi-user authentication with two roles
(Forecaster/Admin and Standard User), region-wise confidence grids across a
1-to-10-day horizon, bust probability computations, meteorological driver
attributions, and alert notifications.

## Tables

1. **profiles** — Extends auth.users with a role (forecaster | user) and display name.
2. **regions** — Geographical target zones with bounding coordinates and metadata.
3. **forecasts** — NWP model runs: model source (GFS/ECMWF), initialization time, notes.
4. **confidence_scores** — Per-region, per-forecast, per-day (1-10) confidence percentage
   plus contributing sub-metrics (ROC-AUC, Brier Score, FAR).
5. **bust_probabilities** — Per-region, per-forecast bust likelihood percentage,
   severity classification, and structural model failure description.
6. **driver_attributions** — Feature attribution breakdowns isolating physical
   parameters (moisture flux divergence, pressure gradient variance, wind shear
   anomalies, etc.) behind low-confidence alerts.
7. **alerts** — Automated risk alerts dispatched to stakeholders with type, severity,
   channel, and message.

## Security
- RLS enabled on every table.
- profiles: owner-scoped (users manage their own profile).
- regions, forecasts: readable by all authenticated users; writable by forecasters/admins.
- confidence_scores, bust_probabilities, driver_attributions: readable by all
  authenticated users; writable by forecasters/admins.
- alerts: readable by all authenticated users; writable by forecasters/admins.

## Notes
1. Role is stored in profiles.role as text with a CHECK constraint.
2. All confidence/bust values are stored as numeric(5,2) representing percentages (0-100).
3. Day horizon is an integer 1-10 with a CHECK constraint.
4. All timestamps are timestamptz with sensible defaults.
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('forecaster', 'user')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- REGIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  lat_min numeric(8,4) NOT NULL,
  lat_max numeric(8,4) NOT NULL,
  lon_min numeric(8,4) NOT NULL,
  lon_max numeric(8,4) NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_regions" ON regions;
CREATE POLICY "read_regions" ON regions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_regions" ON regions;
CREATE POLICY "insert_regions" ON regions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

DROP POLICY IF EXISTS "update_regions" ON regions;
CREATE POLICY "update_regions" ON regions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

DROP POLICY IF EXISTS "delete_regions" ON regions;
CREATE POLICY "delete_regions" ON regions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

-- ============================================================
-- FORECASTS (NWP model runs)
-- ============================================================
CREATE TABLE IF NOT EXISTS forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_source text NOT NULL CHECK (model_source IN ('GFS', 'ECMWF', 'ICON', 'UKMO')),
  init_time timestamptz NOT NULL,
  run_cycle text DEFAULT '00z',
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_forecasts" ON forecasts;
CREATE POLICY "read_forecasts" ON forecasts FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_forecasts" ON forecasts;
CREATE POLICY "insert_forecasts" ON forecasts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

DROP POLICY IF EXISTS "update_forecasts" ON forecasts;
CREATE POLICY "update_forecasts" ON forecasts FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

DROP POLICY IF EXISTS "delete_forecasts" ON forecasts;
CREATE POLICY "delete_forecasts" ON forecasts FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

-- ============================================================
-- CONFIDENCE SCORES (per region, per forecast, per day 1-10)
-- ============================================================
CREATE TABLE IF NOT EXISTS confidence_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  day_horizon integer NOT NULL CHECK (day_horizon >= 1 AND day_horizon <= 10),
  confidence_pct numeric(5,2) NOT NULL CHECK (confidence_pct >= 0 AND confidence_pct <= 100),
  roc_auc numeric(5,4) CHECK (roc_auc >= 0 AND roc_auc <= 1),
  brier_score numeric(5,4) CHECK (brier_score >= 0 AND brier_score <= 1),
  false_alarm_rate numeric(5,4) CHECK (false_alarm_rate >= 0 AND false_alarm_rate <= 1),
  temperature_anomaly numeric(6,2),
  precipitation_anomaly numeric(6,2),
  pressure_anomaly numeric(6,2),
  created_at timestamptz DEFAULT now(),
  UNIQUE (forecast_id, region_id, day_horizon)
);

ALTER TABLE confidence_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_confidence_scores" ON confidence_scores;
CREATE POLICY "read_confidence_scores" ON confidence_scores FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_confidence_scores" ON confidence_scores;
CREATE POLICY "insert_confidence_scores" ON confidence_scores FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

DROP POLICY IF EXISTS "update_confidence_scores" ON confidence_scores;
CREATE POLICY "update_confidence_scores" ON confidence_scores FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

DROP POLICY IF EXISTS "delete_confidence_scores" ON confidence_scores;
CREATE POLICY "delete_confidence_scores" ON confidence_scores FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

-- ============================================================
-- BUST PROBABILITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS bust_probabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  day_horizon integer NOT NULL CHECK (day_horizon >= 1 AND day_horizon <= 10),
  bust_probability numeric(5,2) NOT NULL CHECK (bust_probability >= 0 AND bust_probability <= 100),
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  failure_description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (forecast_id, region_id, day_horizon)
);

ALTER TABLE bust_probabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_bust_probabilities" ON bust_probabilities;
CREATE POLICY "read_bust_probabilities" ON bust_probabilities FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_bust_probabilities" ON bust_probabilities;
CREATE POLICY "insert_bust_probabilities" ON bust_probabilities FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

DROP POLICY IF EXISTS "update_bust_probabilities" ON bust_probabilities;
CREATE POLICY "update_bust_probabilities" ON bust_probabilities FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

DROP POLICY IF EXISTS "delete_bust_probabilities" ON bust_probabilities;
CREATE POLICY "delete_bust_probabilities" ON bust_probabilities FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

-- ============================================================
-- DRIVER ATTRIBUTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS driver_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
  region_id uuid NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  day_horizon integer NOT NULL CHECK (day_horizon >= 1 AND day_horizon <= 10),
  parameter_name text NOT NULL,
  attribution_score numeric(5,4) NOT NULL CHECK (attribution_score >= -1 AND attribution_score <= 1),
  anomaly_value numeric(6,2),
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE driver_attributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_driver_attributions" ON driver_attributions;
CREATE POLICY "read_driver_attributions" ON driver_attributions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_driver_attributions" ON driver_attributions;
CREATE POLICY "insert_driver_attributions" ON driver_attributions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

DROP POLICY IF EXISTS "update_driver_attributions" ON driver_attributions;
CREATE POLICY "update_driver_attributions" ON driver_attributions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

DROP POLICY IF EXISTS "delete_driver_attributions" ON driver_attributions;
CREATE POLICY "delete_driver_attributions" ON driver_attributions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

-- ============================================================
-- ALERTS
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid REFERENCES forecasts(id) ON DELETE CASCADE,
  region_id uuid REFERENCES regions(id) ON DELETE SET NULL,
  alert_type text NOT NULL DEFAULT 'bust_risk' CHECK (alert_type IN ('bust_risk', 'low_confidence', 'system', 'data_ingestion')),
  severity text NOT NULL DEFAULT 'moderate' CHECK (severity IN ('low', 'moderate', 'high', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  channel text NOT NULL DEFAULT 'app' CHECK (channel IN ('app', 'sms', 'webhook')),
  acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_alerts" ON alerts;
CREATE POLICY "read_alerts" ON alerts FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_alerts" ON alerts;
CREATE POLICY "insert_alerts" ON alerts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

DROP POLICY IF EXISTS "update_alerts" ON alerts;
CREATE POLICY "update_alerts" ON alerts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_alerts" ON alerts;
CREATE POLICY "delete_alerts" ON alerts FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'forecaster')
  );

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_confidence_forecast ON confidence_scores(forecast_id);
CREATE INDEX IF NOT EXISTS idx_confidence_region ON confidence_scores(region_id);
CREATE INDEX IF NOT EXISTS idx_confidence_day ON confidence_scores(day_horizon);
CREATE INDEX IF NOT EXISTS idx_bust_forecast ON bust_probabilities(forecast_id);
CREATE INDEX IF NOT EXISTS idx_bust_region ON bust_probabilities(region_id);
CREATE INDEX IF NOT EXISTS idx_bust_day ON bust_probabilities(day_horizon);
CREATE INDEX IF NOT EXISTS idx_driver_forecast ON driver_attributions(forecast_id);
CREATE INDEX IF NOT EXISTS idx_driver_region ON driver_attributions(region_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

-- ============================================================
-- TRIGGER: auto-create profile on signup + updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'role', 'user'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();