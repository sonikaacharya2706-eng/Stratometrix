import { useState, useMemo } from 'react';
import { Region, DriverAttribution, ConfidenceScore } from '@/lib/supabase';
import { Eye, Wind, Droplets, Gauge, Layers, Thermometer, ArrowDownRight, ArrowUpRight, Zap } from 'lucide-react';

interface Props {
  regions: Region[];
  driverAttributions: DriverAttribution[];
  confidenceScores: ConfidenceScore[];
}

const DAYS = Array.from({ length: 10 }, (_, i) => i + 1);

function paramIcon(name: string): React.ReactNode {
  const lower = name.toLowerCase();
  if (lower.includes('moisture') || lower.includes('precipitable')) return <Droplets className="w-4 h-4" />;
  if (lower.includes('pressure')) return <Gauge className="w-4 h-4" />;
  if (lower.includes('wind') || lower.includes('vorticity')) return <Wind className="w-4 h-4" />;
  if (lower.includes('temperature') || lower.includes('convective')) return <Thermometer className="w-4 h-4" />;
  if (lower.includes('geopotential') || lower.includes('height')) return <Layers className="w-4 h-4" />;
  return <Zap className="w-4 h-4" />;
}

function attrColor(score: number): string {
  if (score >= 0.5) return 'text-red-400';
  if (score >= 0.2) return 'text-orange-400';
  if (score <= -0.5) return 'text-emerald-400';
  if (score <= -0.2) return 'text-green-400';
  return 'text-amber-400';
}

function attrBarColor(score: number): string {
  if (score >= 0) return 'bg-red-500';
  return 'bg-emerald-500';
}

export default function DriverExplainerPanel({ regions, driverAttributions, confidenceScores }: Props) {
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<number | ''>('');

  const confidenceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of confidenceScores) {
      map.set(`${c.region_id}-${c.day_horizon}`, c.confidence_pct);
    }
    return map;
  }, [confidenceScores]);

  const filtered = useMemo(() => {
    let result = driverAttributions;
    if (selectedRegion) result = result.filter((d) => d.region_id === selectedRegion);
    if (selectedDay !== '') result = result.filter((d) => d.day_horizon === selectedDay);
    return result.sort((a, b) => Math.abs(b.attribution_score) - Math.abs(a.attribution_score));
  }, [driverAttributions, selectedRegion, selectedDay]);

  // Aggregate by parameter across all filtered results
  const paramSummary = useMemo(() => {
    const summary = new Map<string, { totalScore: number; count: number; maxAbs: number }>();
    for (const d of filtered) {
      const existing = summary.get(d.parameter_name) || { totalScore: 0, count: 0, maxAbs: 0 };
      existing.totalScore += d.attribution_score;
      existing.count += 1;
      existing.maxAbs = Math.max(existing.maxAbs, Math.abs(d.attribution_score));
      summary.set(d.parameter_name, existing);
    }
    return Array.from(summary.entries())
      .map(([name, { totalScore, count, maxAbs }]) => ({
        name,
        avgScore: totalScore / count,
        count,
        maxAbs,
      }))
      .sort((a, b) => Math.abs(b.maxAbs) - Math.abs(a.maxAbs));
  }, [filtered]);

  // Group by region+day for the detailed view
  const grouped = useMemo(() => {
    const map = new Map<string, DriverAttribution[]>();
    for (const d of filtered) {
      const key = `${d.region_id}-${d.day_horizon}`;
      const arr = map.get(key) || [];
      arr.push(d);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const confA = confidenceMap.get(a[0]) || 100;
      const confB = confidenceMap.get(b[0]) || 100;
      return confA - confB;
    });
  }, [filtered, confidenceMap]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Meteorological Driver Explainer</h2>
        <p className="text-slate-400 text-sm">
          Feature attribution analysis isolating the physical parameters triggering
          low-confidence alerts. Uses attribution methods to quantify each driver's
          contribution to forecast degradation.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedRegion}
          onChange={(e) => setSelectedRegion(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500"
        >
          <option value="">All Regions</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          value={selectedDay}
          onChange={(e) => setSelectedDay(e.target.value ? Number(e.target.value) : '')}
          className="bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500"
        >
          <option value="">All Days</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>Day {d}</option>
          ))}
        </select>
        {(selectedRegion || selectedDay !== '') && (
          <button
            onClick={() => { setSelectedRegion(''); setSelectedDay(''); }}
            className="text-sm text-slate-400 hover:text-slate-200 transition"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Parameter summary */}
      {paramSummary.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
          <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-sky-400" />
            Top Contributing Parameters
          </h3>
          <div className="space-y-3">
            {paramSummary.map((p) => (
              <div key={p.name} className="flex items-center gap-4">
                <div className="flex items-center gap-2 w-56 flex-shrink-0">
                  {paramIcon(p.name)}
                  <span className="text-sm text-slate-300">{p.name}</span>
                </div>
                <div className="flex-1 relative h-6 bg-slate-800 rounded overflow-hidden">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600" />
                  {p.avgScore >= 0 ? (
                    <div
                      className={`absolute left-1/2 top-0 bottom-0 ${attrBarColor(p.avgScore)} rounded-r`}
                      style={{ width: `${(p.avgScore / 1) * 50}%` }}
                    />
                  ) : (
                    <div
                      className={`absolute right-1/2 top-0 bottom-0 ${attrBarColor(p.avgScore)} rounded-l`}
                      style={{ width: `${(Math.abs(p.avgScore) / 1) * 50}%` }}
                    />
                  )}
                </div>
                <div className="w-24 text-right flex items-center justify-end gap-1">
                  {p.avgScore >= 0 ? (
                    <ArrowUpRight className={`w-4 h-4 ${attrColor(p.avgScore)}`} />
                  ) : (
                    <ArrowDownRight className={`w-4 h-4 ${attrColor(p.avgScore)}`} />
                  )}
                  <span className={`text-sm font-bold ${attrColor(p.avgScore)}`}>
                    {p.avgScore >= 0 ? '+' : ''}{p.avgScore.toFixed(3)}
                  </span>
                </div>
                <span className="text-xs text-slate-500 w-16 text-right">{p.count} attrs</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-red-400" /> Positive = degrades confidence</span>
            <span className="flex items-center gap-1"><ArrowDownRight className="w-3 h-3 text-emerald-400" /> Negative = stabilizes confidence</span>
          </div>
        </div>
      )}

      {/* Detailed attribution cards */}
      <div>
        <h3 className="text-lg font-semibold mb-3">
          Attribution Breakdown by Sector ({grouped.length})
        </h3>
        {grouped.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Eye className="w-12 h-12 mx-auto mb-3 text-slate-700" />
            <p>No driver attributions for the selected filters.</p>
            <p className="text-sm mt-1">Attributions are generated for low-confidence zones (confidence &lt; 65% or bust &gt; 40%).</p>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {grouped.map(([key, drivers]) => {
            const [regionId, dayStr] = key.split('-');
            const day = parseInt(dayStr);
            const region = regions.find((r) => r.id === regionId);
            const confidence = confidenceMap.get(key);
            return (
              <div key={key} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-slate-200">{region?.name || 'Unknown'}</h4>
                    <p className="text-xs text-slate-500">Day {day}</p>
                  </div>
                  {confidence !== undefined && (
                    <div className={`px-2 py-1 rounded text-xs font-bold ${confidence < 40 ? 'bg-red-500/20 text-red-400' : confidence < 65 ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                      {confidence.toFixed(1)}% confidence
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {drivers.map((d) => (
                    <div key={d.id} className="flex items-start gap-3 p-2 rounded-lg bg-slate-800/40">
                      <div className="text-sky-400 mt-0.5">{paramIcon(d.parameter_name)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-slate-200">{d.parameter_name}</span>
                          <span className={`text-sm font-bold ${attrColor(d.attribution_score)}`}>
                            {d.attribution_score >= 0 ? '+' : ''}{d.attribution_score.toFixed(3)}
                          </span>
                        </div>
                        {d.anomaly_value !== null && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            Anomaly: {d.anomaly_value >= 0 ? '+' : ''}{d.anomaly_value.toFixed(2)} σ
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">{d.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
