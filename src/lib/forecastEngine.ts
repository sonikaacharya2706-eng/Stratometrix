import { supabase, Region, Forecast, ConfidenceScore, BustProbability, DriverAttribution, Alert } from '@/lib/supabase';

// ─── Seed regions representing major meteorological zones ───
export const SEED_REGIONS = [
  { name: 'North India Plains', code: 'NIP', lat_min: 26, lat_max: 32, lon_min: 74, lon_max: 88, description: 'Indo-Gangetic plain — high monsoon variability' },
  { name: 'Western Himalaya', code: 'WHM', lat_min: 30, lat_max: 36, lon_min: 73, lon_max: 80, description: 'Complex orographic terrain — extreme precipitation events' },
  { name: 'Central Indian Plateau', code: 'CIP', lat_min: 20, lat_max: 26, lon_min: 76, lon_max: 84, description: 'Deccan plateau — heat dome and dry-line dynamics' },
  { name: 'Eastern Coast & Bay', code: 'ECB', lat_min: 12, lat_max: 22, lon_min: 80, lon_max: 88, description: 'Cyclone landfall corridor — Bay of Bengal influence' },
  { name: 'Western Arid Zone', code: 'WAZ', lat_min: 24, lat_max: 30, lon_min: 68, lon_max: 74, description: 'Thar desert — dust aerosol and radiative forcing' },
  { name: 'Southern Peninsula', code: 'SPN', lat_min: 8, lat_max: 16, lon_min: 76, lon_max: 80, description: 'Tropical maritime — convective instability zone' },
  { name: 'Northeast Valley', code: 'NEV', lat_min: 24, lat_max: 28, lon_min: 90, lon_max: 96, description: 'Brahmaputra valley — orographic moisture convergence' },
  { name: 'Coastal Konkan', code: 'CKN', lat_min: 16, lat_max: 22, lon_min: 72, lon_max: 76, description: 'Western Ghats lee — orographic rainfall enhancement' },
];

const PARAMETER_NAMES = [
  'Moisture Flux Divergence',
  'Pressure Gradient Variance',
  'Wind Shear Anomaly',
  'Geopotential Height Anomaly',
  'Convective Available Potential Energy',
  'Vorticity Advection',
  'Temperature Advection',
  'Precipitable Water Anomaly',
];

const MODEL_SOURCES: Forecast['model_source'][] = ['GFS', 'ECMWF', 'ICON', 'UKMO'];

// Deterministic pseudo-random generator for reproducible seeds
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function severityFromBust(bustPct: number): BustProbability['severity'] {
  if (bustPct >= 70) return 'critical';
  if (bustPct >= 50) return 'high';
  if (bustPct >= 30) return 'moderate';
  return 'low';
}

// ─── Generate a single forecast run with all derived data ───
export async function generateForecastRun(): Promise<{ forecast: Forecast | null; error: string | null }> {
  const now = Date.now();
  const seed = now % 1000000;
  const rng = seededRandom(seed);

  const modelSource = MODEL_SOURCES[Math.floor(rng() * MODEL_SOURCES.length)];
  const initTime = new Date(now - Math.floor(rng() * 6) * 3600 * 1000).toISOString();

  // Fetch all regions
  const { data: regions, error: regionErr } = await supabase.from('regions').select('*');
  if (regionErr || !regions || regions.length === 0) {
    return { forecast: null, error: regionErr?.message ?? 'No regions found. Please seed regions first.' };
  }

  // Get current user
  const { data: userData } = await supabase.auth.getUser();
  const createdBy = userData.user?.id ?? null;

  // Create forecast record
  const { data: forecastData, error: forecastErr } = await supabase
    .from('forecasts')
    .insert({
      model_source: modelSource,
      init_time: initTime,
      run_cycle: '00z',
      notes: `Synthesized ${modelSource} run — ${new Date().toISOString()}`,
      created_by: createdBy,
    })
    .select()
    .single();

  if (forecastErr || !forecastData) {
    return { forecast: null, error: forecastErr?.message ?? 'Failed to create forecast.' };
  }

  const forecast = forecastData as Forecast;
  const forecastId = forecast.id;

  const confidenceRows: Omit<ConfidenceScore, 'id' | 'created_at'>[] = [];
  const bustRows: Omit<BustProbability, 'id' | 'created_at'>[] = [];
  const driverRows: Omit<DriverAttribution, 'id' | 'created_at'>[] = [];
  const alertRows: Omit<Alert, 'id' | 'created_at' | 'acknowledged' | 'acknowledged_by' | 'acknowledged_at'>[] = [];

  for (const region of regions as Region[]) {
    // Each region has a base confidence that degrades with day horizon
    const baseConfidence = 75 + rng() * 20; // 75-95
    const degradeRate = 2 + rng() * 4; // 2-6% per day
    const regionSeed = (region.lat_min + region.lon_min) * 1000 + seed;

    for (let day = 1; day <= 10; day++) {
      const dayRng = seededRandom(regionSeed + day * 7);
      const noise = (dayRng() - 0.5) * 8;
      const confidence = clamp(baseConfidence - degradeRate * (day - 1) + noise, 15, 98);

      const rocAuc = clamp(0.5 + (confidence / 100) * 0.45 + (dayRng() - 0.5) * 0.1, 0.5, 0.99);
      const brier = clamp(0.3 - (confidence / 100) * 0.25 + (dayRng() - 0.5) * 0.1, 0.01, 0.5);
      const far = clamp(0.4 - (confidence / 100) * 0.3 + (dayRng() - 0.5) * 0.1, 0.02, 0.5);

      const tempAnom = (dayRng() - 0.5) * 6;
      const precipAnom = (dayRng() - 0.5) * 40;
      const pressureAnom = (dayRng() - 0.5) * 8;

      confidenceRows.push({
        forecast_id: forecastId,
        region_id: region.id,
        day_horizon: day,
        confidence_pct: parseFloat(confidence.toFixed(2)),
        roc_auc: parseFloat(rocAuc.toFixed(4)),
        brier_score: parseFloat(brier.toFixed(4)),
        false_alarm_rate: parseFloat(far.toFixed(4)),
        temperature_anomaly: parseFloat(tempAnom.toFixed(2)),
        precipitation_anomaly: parseFloat(precipAnom.toFixed(2)),
        pressure_anomaly: parseFloat(pressureAnom.toFixed(2)),
      });

      // Bust probability is inversely related to confidence with extra noise
      const bustBase = 100 - confidence;
      const bustNoise = (dayRng() - 0.5) * 15;
      const bustProb = clamp(bustBase + bustNoise + (day - 1) * 1.5, 2, 95);
      const severity = severityFromBust(bustProb);

      let failureDesc = '';
      if (severity === 'critical') {
        failureDesc = 'Structural model failure likely — large-scale pattern reversal detected. Ensemble spread exceeds 2σ threshold.';
      } else if (severity === 'high') {
        failureDesc = 'Elevated bust risk — ensemble divergence and historical analog mismatch indicate regime transition uncertainty.';
      } else if (severity === 'moderate') {
        failureDesc = 'Moderate uncertainty — forecast skill degrading at this horizon; monitor for downstream pattern amplification.';
      } else {
        failureDesc = 'Low bust probability — ensemble agreement within historical norms.';
      }

      bustRows.push({
        forecast_id: forecastId,
        region_id: region.id,
        day_horizon: day,
        bust_probability: parseFloat(bustProb.toFixed(2)),
        severity,
        failure_description: failureDesc,
      });

      // Generate driver attributions for low-confidence or high-bust days
      if (confidence < 65 || bustProb > 40) {
        const numDrivers = 2 + Math.floor(dayRng() * 3); // 2-4 drivers
        const shuffled = [...PARAMETER_NAMES].sort(() => dayRng() - 0.5).slice(0, numDrivers);
        for (const paramName of shuffled) {
          const attrScore = parseFloat(((dayRng() - 0.5) * 1.8).toFixed(4));
          const anomalyVal = parseFloat(((dayRng() - 0.5) * 50).toFixed(2));
          const desc = `Attribution score ${attrScore > 0 ? 'positively' : 'negatively'} correlated with forecast degradation. ` +
            `Anomaly value: ${anomalyVal > 0 ? '+' : ''}${anomalyVal} σ from climatological mean.`;
          driverRows.push({
            forecast_id: forecastId,
            region_id: region.id,
            day_horizon: day,
            parameter_name: paramName,
            attribution_score: attrScore,
            anomaly_value: anomalyVal,
            description: desc,
          });
        }

        // Generate alert for high-severity busts
        if (severity === 'critical' || severity === 'high') {
          alertRows.push({
            forecast_id: forecastId,
            region_id: region.id,
            alert_type: 'bust_risk',
            severity,
            title: `${severity.toUpperCase()} bust risk — ${region.name} (Day ${day})`,
            message: `${modelSource} ${severity} bust probability ${bustProb.toFixed(1)}% for ${region.name} at Day ${day}. ${failureDesc}`,
            channel: 'app',
          });
        }
      }
    }
  }

  // Batch insert all derived data
  const errors: string[] = [];

  // Insert confidence scores in chunks
  for (let i = 0; i < confidenceRows.length; i += 50) {
    const chunk = confidenceRows.slice(i, i + 50);
    const { error } = await supabase.from('confidence_scores').insert(chunk);
    if (error) errors.push(`confidence: ${error.message}`);
  }

  for (let i = 0; i < bustRows.length; i += 50) {
    const chunk = bustRows.slice(i, i + 50);
    const { error } = await supabase.from('bust_probabilities').insert(chunk);
    if (error) errors.push(`bust: ${error.message}`);
  }

  for (let i = 0; i < driverRows.length; i += 50) {
    const chunk = driverRows.slice(i, i + 50);
    const { error } = await supabase.from('driver_attributions').insert(chunk);
    if (error) errors.push(`driver: ${error.message}`);
  }

  for (let i = 0; i < alertRows.length; i += 50) {
    const chunk = alertRows.slice(i, i + 50);
    const { error } = await supabase.from('alerts').insert(chunk);
    if (error) errors.push(`alert: ${error.message}`);
  }

  if (errors.length > 0) {
    return { forecast, error: `Partial errors: ${errors.join('; ')}` };
  }

  return { forecast, error: null };
}

// ─── Seed regions if they don't exist yet ───
export async function ensureRegionsSeeded(): Promise<{ error: string | null }> {
  const { data: existing, error } = await supabase.from('regions').select('id').limit(1);
  if (error) return { error: error.message };
  if (existing && existing.length > 0) return { error: null };

  const { error: insertError } = await supabase.from('regions').insert(
    SEED_REGIONS.map((r) => ({
      name: r.name,
      code: r.code,
      lat_min: r.lat_min,
      lat_max: r.lat_max,
      lon_min: r.lon_min,
      lon_max: r.lon_max,
      description: r.description,
    }))
  );
  if (insertError) return { error: insertError.message };
  return { error: null };
}
