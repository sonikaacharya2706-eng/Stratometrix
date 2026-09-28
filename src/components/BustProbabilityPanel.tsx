import { useState, useMemo } from 'react';
import { Region, BustProbability } from '@/lib/supabase';
import { Activity, TrendingDown, AlertOctagon, Filter } from 'lucide-react';

interface Props {
  regions: Region[];
  bustProbabilities: BustProbability[];
}

const DAYS = Array.from({ length: 10 }, (_, i) => i + 1);

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-500 text-white border-red-400';
    case 'high': return 'bg-orange-500 text-white border-orange-400';
    case 'moderate': return 'bg-amber-500 text-slate-950 border-amber-400';
    case 'low': return 'bg-emerald-500 text-slate-950 border-emerald-400';
    default: return 'bg-slate-700 text-slate-200 border-slate-600';
  }
}

function bustBarColor(pct: number): string {
  if (pct >= 70) return 'bg-red-500';
  if (pct >= 50) return 'bg-orange-500';
  if (pct >= 30) return 'bg-amber-500';
  return 'bg-emerald-500';
}

export default function BustProbabilityPanel({ regions, bustProbabilities }: Props) {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const bustMap = useMemo(() => {
    const map = new Map<string, BustProbability>();
    for (const b of bustProbabilities) {
      map.set(`${b.region_id}-${b.day_horizon}`, b);
    }
    return map;
  }, [bustProbabilities]);

  const filtered = useMemo(() => {
    let result = bustProbabilities;
    if (severityFilter !== 'all') {
      result = result.filter((b) => b.severity === severityFilter);
    }
    if (selectedRegion) {
      result = result.filter((b) => b.region_id === selectedRegion);
    }
    return result.sort((a, b) => b.bust_probability - a.bust_probability);
  }, [bustProbabilities, severityFilter, selectedRegion]);

  const stats = useMemo(() => {
    const total = bustProbabilities.length;
    const critical = bustProbabilities.filter((b) => b.severity === 'critical').length;
    const high = bustProbabilities.filter((b) => b.severity === 'high').length;
    const moderate = bustProbabilities.filter((b) => b.severity === 'moderate').length;
    const low = bustProbabilities.filter((b) => b.severity === 'low').length;
    const avg = total > 0 ? bustProbabilities.reduce((s, b) => s + b.bust_probability, 0) / total : 0;
    return { total, critical, high, moderate, low, avg };
  }, [bustProbabilities]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Real-Time Bust Probability Engine</h2>
        <p className="text-slate-400 text-sm">
          Statistical likelihood of structural model failure for high-impact events
          across defined coordinate sectors. Compares current forecast patterns with
          historical error behaviors.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total Sectors" value={stats.total} icon={<Activity className="w-4 h-4" />} />
        <StatCard label="Critical" value={stats.critical} color="text-red-400" border="border-red-800/50" />
        <StatCard label="High Risk" value={stats.high} color="text-orange-400" border="border-orange-800/50" />
        <StatCard label="Moderate" value={stats.moderate} color="text-amber-400" border="border-amber-800/50" />
        <StatCard label="Avg Bust %" value={`${stats.avg.toFixed(1)}%`} color="text-sky-400" border="border-sky-800/50" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Filter className="w-4 h-4" />
          <span>Filter:</span>
        </div>
        {['all', 'critical', 'high', 'moderate', 'low'].map((sev) => (
          <button
            key={sev}
            onClick={() => setSeverityFilter(sev)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition capitalize ${
              severityFilter === sev
                ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            {sev}
          </button>
        ))}
        <select
          value={selectedRegion || ''}
          onChange={(e) => setSelectedRegion(e.target.value || null)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-sky-500"
        >
          <option value="">All Regions</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Heatmap table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/30">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-900 text-left px-4 py-3 text-xs font-semibold text-slate-400 border-b border-r border-slate-800">Region</th>
              {DAYS.map((day) => (
                <th key={day} className="px-2 py-3 text-xs font-semibold text-slate-400 border-b border-slate-800 text-center min-w-[64px]">Day {day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regions.map((region) => (
              <tr key={region.id} className="hover:bg-slate-800/30">
                <td className="sticky left-0 z-10 bg-slate-900 px-4 py-3 border-b border-r border-slate-800">
                  <p className="text-sm font-medium text-slate-200 leading-tight">{region.name}</p>
                  <p className="text-xs text-slate-500">{region.code}</p>
                </td>
                {DAYS.map((day) => {
                  const bust = bustMap.get(`${region.id}-${day}`);
                  if (!bust) {
                    return (
                      <td key={day} className="p-1 border-b border-slate-800 text-center">
                        <div className="h-10 rounded bg-slate-800/50 flex items-center justify-center">
                          <span className="text-slate-600 text-xs">—</span>
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td key={day} className="p-1 border-b border-slate-800 text-center">
                      <div className={`h-10 rounded flex items-center justify-center text-xs font-bold border ${severityColor(bust.severity)}`}>
                        {bust.bust_probability.toFixed(0)}%
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detailed list */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-orange-400" />
          High-Impact Events ({filtered.length})
        </h3>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-slate-500 text-sm py-4 text-center">No events match the current filter.</p>
          )}
          {filtered.map((bust) => {
            const region = regions.find((r) => r.id === bust.region_id);
            return (
              <div key={bust.id} className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${severityColor(bust.severity)}`}>
                        {bust.severity}
                      </span>
                      <span className="font-medium text-slate-200">{region?.name || 'Unknown'}</span>
                      <span className="text-sm text-slate-500">· Day {bust.day_horizon}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-100">{bust.bust_probability.toFixed(1)}%</p>
                    <p className="text-xs text-slate-500">bust probability</p>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${bustBarColor(bust.bust_probability)}`}
                      style={{ width: `${bust.bust_probability}%` }}
                    />
                  </div>
                </div>
                {bust.failure_description && (
                  <p className="text-sm text-slate-400 mt-2 flex items-start gap-2">
                    <TrendingDown className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-500" />
                    {bust.failure_description}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, border, icon }: { label: string; value: string | number; color?: string; border?: string; icon?: React.ReactNode }) {
  return (
    <div className={`p-4 rounded-xl border bg-slate-900/50 ${border || 'border-slate-800'}`}>
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-2">
        {icon}
        {label}
      </div>
      <p className={`text-2xl font-bold ${color || 'text-slate-100'}`}>{value}</p>
    </div>
  );
}
