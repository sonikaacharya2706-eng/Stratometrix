import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, Forecast, Region, ConfidenceScore, BustProbability, DriverAttribution, Alert } from '@/lib/supabase';
import { ensureRegionsSeeded, generateForecastRun } from '@/lib/forecastEngine';
import { CloudLightning, Map, Activity, Eye, Bell, LogOut, RefreshCw, Plus, Globe, TrendingDown, Zap, AlertTriangle } from 'lucide-react';
import ConfidenceMap from '@/components/ConfidenceMap';
import BustProbabilityPanel from '@/components/BustProbabilityPanel';
import DriverExplainerPanel from '@/components/DriverExplainerPanel';
import AlertsPanel from '@/components/AlertsPanel';

type Tab = 'map' | 'bust' | 'drivers' | 'alerts';

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [selectedForecastId, setSelectedForecastId] = useState<string | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [confidenceScores, setConfidenceScores] = useState<ConfidenceScore[]>([]);
  const [bustProbabilities, setBustProbabilities] = useState<BustProbability[]>([]);
  const [driverAttributions, setDriverAttributions] = useState<DriverAttribution[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isForecaster = profile?.role === 'forecaster';

  const loadForecasts = useCallback(async () => {
    const { data, error } = await supabase
      .from('forecasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) { setError(error.message); return; }
    const fcasts = (data || []) as Forecast[];
    setForecasts(fcasts);
    if (fcasts.length > 0 && !selectedForecastId) {
      setSelectedForecastId(fcasts[0].id);
    }
  }, [selectedForecastId]);

  const loadRegions = useCallback(async () => {
    const { data, error } = await supabase.from('regions').select('*').order('name');
    if (error) { setError(error.message); return; }
    setRegions((data || []) as Region[]);
  }, []);

  const loadForecastData = useCallback(async (forecastId: string) => {
    setLoading(true);
    setError(null);

    const [confRes, bustRes, driverRes, alertRes] = await Promise.all([
      supabase.from('confidence_scores').select('*').eq('forecast_id', forecastId),
      supabase.from('bust_probabilities').select('*').eq('forecast_id', forecastId),
      supabase.from('driver_attributions').select('*').eq('forecast_id', forecastId),
      supabase.from('alerts').select('*').eq('forecast_id', forecastId).order('created_at', { ascending: false }),
    ]);

    if (confRes.error) setError(confRes.error.message);
    if (bustRes.error) setError(bustRes.error.message);
    if (driverRes.error) setError(driverRes.error.message);
    if (alertRes.error) setError(alertRes.error.message);

    setConfidenceScores((confRes.data || []) as ConfidenceScore[]);
    setBustProbabilities((bustRes.data || []) as BustProbability[]);
    setDriverAttributions((driverRes.data || []) as DriverAttribution[]);
    setAlerts((alertRes.data || []) as Alert[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      await ensureRegionsSeeded();
      await loadRegions();
      await loadForecasts();
    })();
  }, [loadRegions, loadForecasts]);

  useEffect(() => {
    if (selectedForecastId) {
      loadForecastData(selectedForecastId);
    }
  }, [selectedForecastId, loadForecastData]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    const { error } = await generateForecastRun();
    if (error) setError(error);
    await loadForecasts();
    if (forecasts.length > 0) {
      // Will pick up the newest forecast after reload
    }
    setGenerating(false);
  };

  const handleRefresh = async () => {
    await loadForecasts();
    if (selectedForecastId) await loadForecastData(selectedForecastId);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'map', label: 'Confidence Map', icon: <Map className="w-4 h-4" /> },
    { id: 'bust', label: 'Bust Probability', icon: <Activity className="w-4 h-4" /> },
    { id: 'drivers', label: 'Driver Explainer', icon: <Eye className="w-4 h-4" /> },
    { id: 'alerts', label: 'Alerts', icon: <Bell className="w-4 h-4" /> },
  ];

  const selectedForecast = forecasts.find((f) => f.id === selectedForecastId);
  const alertCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top bar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center">
              <CloudLightning className="w-5 h-5 text-sky-400" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold leading-none">Stratometrix</h1>
              <p className="text-xs text-slate-500 mt-0.5">Forecast Confidence & Bust Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Forecast selector */}
            <select
              value={selectedForecastId || ''}
              onChange={(e) => setSelectedForecastId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500 max-w-[200px] sm:max-w-xs"
            >
              {forecasts.length === 0 && <option value="">No forecasts</option>}
              {forecasts.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.model_source} · {new Date(f.init_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </option>
              ))}
            </select>

            {isForecaster && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-medium transition"
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {generating ? 'Generating…' : 'New Run'}
              </button>
            )}

            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 transition"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-700">
              <div className="text-right">
                <p className="text-sm font-medium text-slate-200 leading-none">{profile?.full_name || profile?.email}</p>
                <p className="text-xs text-slate-500 mt-0.5 capitalize">
                  {profile?.role === 'forecaster' ? 'Forecaster / Admin' : 'Standard User'}
                </p>
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-lg bg-slate-800 border border-slate-700 hover:border-red-700 hover:text-red-300 text-slate-300 transition"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 lg:px-6 flex items-center gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-sky-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === 'alerts' && alertCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full bg-red-500 text-white">
                  {alertCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Mobile actions */}
      <div className="sm:hidden flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/30">
        {isForecaster && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white text-sm font-medium"
          >
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {generating ? 'Generating…' : 'New Run'}
          </button>
        )}
        <button onClick={signOut} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm">
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <main className="flex-1 p-4 lg:p-6">
        {error && (
          <div className="mb-4 flex items-start gap-3 p-4 rounded-lg bg-red-950/50 border border-red-800/50 text-red-200 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!selectedForecastId && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Globe className="w-16 h-16 text-slate-700 mb-4" />
            <h2 className="text-xl font-semibold text-slate-300 mb-2">No forecast runs yet</h2>
            <p className="text-slate-500 mb-6 max-w-md">
              {isForecaster
                ? 'Generate a new forecast run to populate the confidence map, bust probability engine, and driver attributions.'
                : 'A forecaster needs to generate a forecast run before data is available.'}
            </p>
            {isForecaster && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white font-medium transition"
              >
                {generating ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                {generating ? 'Generating forecast…' : 'Generate First Run'}
              </button>
            )}
          </div>
        )}

        {selectedForecastId && (
          <>
            {/* Forecast summary bar */}
            <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryCard
                icon={<Globe className="w-4 h-4" />}
                label="Model Source"
                value={selectedForecast?.model_source || '—'}
                sub={selectedForecast ? `${selectedForecast.run_cycle} run` : ''}
              />
              <SummaryCard
                icon={<RefreshCw className="w-4 h-4" />}
                label="Init Time"
                value={selectedForecast ? new Date(selectedForecast.init_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                sub="UTC"
              />
              <SummaryCard
                icon={<TrendingDown className="w-4 h-4" />}
                label="Avg Confidence"
                value={confidenceScores.length > 0 ? `${(confidenceScores.reduce((s, c) => s + c.confidence_pct, 0) / confidenceScores.length).toFixed(1)}%` : '—'}
                sub={`${confidenceScores.length} grid points`}
              />
              <SummaryCard
                icon={<Zap className="w-4 h-4" />}
                label="High-Risk Zones"
                value={bustProbabilities.filter((b) => b.severity === 'high' || b.severity === 'critical').length.toString()}
                sub={`${alerts.length} active alerts`}
                alert={alerts.length > 0}
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 text-sky-500 animate-spin" />
              </div>
            ) : (
              <>
                {activeTab === 'map' && (
                  <ConfidenceMap
                    regions={regions}
                    confidenceScores={confidenceScores}
                    bustProbabilities={bustProbabilities}
                  />
                )}
                {activeTab === 'bust' && (
                  <BustProbabilityPanel
                    regions={regions}
                    bustProbabilities={bustProbabilities}
                  />
                )}
                {activeTab === 'drivers' && (
                  <DriverExplainerPanel
                    regions={regions}
                    driverAttributions={driverAttributions}
                    confidenceScores={confidenceScores}
                  />
                )}
                {activeTab === 'alerts' && (
                  <AlertsPanel alerts={alerts} regions={regions} isForecaster={isForecaster} />
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SummaryCard({ icon, label, value, sub, alert }: { icon: React.ReactNode; label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className={`p-4 rounded-xl border bg-slate-900/50 ${alert ? 'border-red-800/50' : 'border-slate-800'}`}>
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
        {icon}
        {label}
      </div>
      <p className="text-lg font-bold text-slate-100 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}
