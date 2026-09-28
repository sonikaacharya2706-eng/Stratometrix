import { useState, useMemo } from 'react';
import { Region, ConfidenceScore, BustProbability } from '@/lib/supabase';
import { MapPin, ChevronRight, Info } from 'lucide-react';

interface Props {
  regions: Region[];
  confidenceScores: ConfidenceScore[];
  bustProbabilities: BustProbability[];
}

const DAYS = Array.from({ length: 10 }, (_, i) => i + 1);

function confidenceColor(pct: number): string {
  if (pct >= 85) return 'bg-emerald-500';
  if (pct >= 70) return 'bg-green-500';
  if (pct >= 55) return 'bg-lime-500';
  if (pct >= 40) return 'bg-amber-500';
  if (pct >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

function confidenceText(pct: number): string {
  if (pct >= 70) return 'text-slate-950';
  return 'text-white';
}

export default function ConfidenceMap({ regions, confidenceScores, bustProbabilities }: Props) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ regionId: string; day: number } | null>(null);

  const scoreMap = useMemo(() => {
    const map = new Map<string, ConfidenceScore>();
    for (const s of confidenceScores) {
      map.set(`${s.region_id}-${s.day_horizon}`, s);
    }
    return map;
  }, [confidenceScores]);

  const bustMap = useMemo(() => {
    const map = new Map<string, BustProbability>();
    for (const b of bustProbabilities) {
      map.set(`${b.region_id}-${b.day_horizon}`, b);
    }
    return map;
  }, [bustProbabilities]);

  const hoveredScore = hoveredCell ? scoreMap.get(`${hoveredCell.regionId}-${hoveredCell.day}`) : null;
  const hoveredBust = hoveredCell ? bustMap.get(`${hoveredCell.regionId}-${hoveredCell.day}`) : null;
  const hoveredRegion = regions.find((r) => r.id === hoveredCell?.regionId);

  const selectedRegionData = selectedRegion ? regions.find((r) => r.id === selectedRegion) : null;
  const selectedScores = selectedRegion ? confidenceScores.filter((s) => s.region_id === selectedRegion).sort((a, b) => a.day_horizon - b.day_horizon) : [];
  const selectedBusts = selectedRegion ? bustProbabilities.filter((b) => b.region_id === selectedRegion).sort((a, b) => a.day_horizon - b.day_horizon) : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Region-Wise Forecast Confidence Map</h2>
        <p className="text-slate-400 text-sm">
          Color-coded confidence gradients across target geographical zones for Day 1–10 horizons.
          Hover any cell for detailed metrics; click a region to view its full horizon breakdown.
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs">
        <span className="text-slate-400 font-medium">Confidence:</span>
        <div className="flex items-center gap-1">
          <div className="flex rounded overflow-hidden">
            <div className="w-8 h-4 bg-red-500" />
            <div className="w-8 h-4 bg-orange-500" />
            <div className="w-8 h-4 bg-amber-500" />
            <div className="w-8 h-4 bg-lime-500" />
            <div className="w-8 h-4 bg-green-500" />
            <div className="w-8 h-4 bg-emerald-500" />
          </div>
          <span className="text-slate-400 ml-2">Low → High</span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <div className="w-3 h-3 rounded-full border-2 border-sky-400 bg-sky-400/20" />
          <span className="text-slate-400">High bust risk overlay</span>
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/30">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-900 text-left px-4 py-3 text-xs font-semibold text-slate-400 border-b border-r border-slate-800">
                Region
              </th>
              {DAYS.map((day) => (
                <th key={day} className="px-2 py-3 text-xs font-semibold text-slate-400 border-b border-slate-800 text-center min-w-[64px]">
                  Day {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {regions.map((region) => (
              <tr
                key={region.id}
                className={`cursor-pointer transition ${selectedRegion === region.id ? 'bg-sky-500/10' : 'hover:bg-slate-800/30'}`}
                onClick={() => setSelectedRegion(selectedRegion === region.id ? null : region.id)}
              >
                <td className="sticky left-0 z-10 bg-slate-900 px-4 py-3 border-b border-r border-slate-800">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-200 leading-tight">{region.name}</p>
                      <p className="text-xs text-slate-500">{region.code}</p>
                    </div>
                    {selectedRegion === region.id && <ChevronRight className="w-4 h-4 text-sky-400 ml-auto" />}
                  </div>
                </td>
                {DAYS.map((day) => {
                  const score = scoreMap.get(`${region.id}-${day}`);
                  const bust = bustMap.get(`${region.id}-${day}`);
                  const isHighBust = bust && (bust.severity === 'high' || bust.severity === 'critical');
                  return (
                    <td
                      key={day}
                      className="p-1 border-b border-slate-800 text-center"
                      onMouseEnter={() => setHoveredCell({ regionId: region.id, day })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {score ? (
                        <div
                          className={`relative h-12 rounded flex items-center justify-center text-xs font-bold transition ${confidenceColor(score.confidence_pct)} ${confidenceText(score.confidence_pct)} ${hoveredCell?.regionId === region.id && hoveredCell?.day === day ? 'ring-2 ring-sky-400 scale-105 z-10' : ''}`}
                        >
                          {score.confidence_pct.toFixed(0)}
                          {isHighBust && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-sky-400 border-2 border-slate-900" />
                          )}
                        </div>
                      ) : (
                        <div className="h-12 rounded bg-slate-800/50 flex items-center justify-center">
                          <span className="text-slate-600 text-xs">—</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hover tooltip */}
      {hoveredScore && hoveredRegion && (
        <div className="flex flex-wrap gap-4 p-4 rounded-xl border border-slate-800 bg-slate-900/50 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-sky-400" />
            <span className="font-semibold text-slate-200">{hoveredRegion.name}</span>
            <span className="text-slate-500">· Day {hoveredScore.day_horizon}</span>
          </div>
          <Metric label="Confidence" value={`${hoveredScore.confidence_pct.toFixed(1)}%`} />
          <Metric label="ROC-AUC" value={hoveredScore.roc_auc?.toFixed(4) || '—'} />
          <Metric label="Brier Score" value={hoveredScore.brier_score?.toFixed(4) || '—'} />
          <Metric label="False Alarm Rate" value={hoveredScore.false_alarm_rate?.toFixed(4) || '—'} />
          {hoveredBust && <Metric label="Bust Probability" value={`${hoveredBust.bust_probability.toFixed(1)}%`} alert={hoveredBust.severity === 'high' || hoveredBust.severity === 'critical'} />}
        </div>
      )}

      {/* Selected region detail */}
      {selectedRegionData && (
        <div className="rounded-xl border border-sky-800/50 bg-slate-900/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-5 h-5 text-sky-400" />
            <h3 className="font-semibold text-slate-100">{selectedRegionData.name} — Horizon Breakdown</h3>
            <span className="text-xs text-slate-500 ml-auto">{selectedRegionData.description}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {selectedScores.map((score) => {
              const bust = selectedBusts.find((b) => b.day_horizon === score.day_horizon);
              return (
                <div key={score.day_horizon} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <p className="text-xs text-slate-400 mb-2">Day {score.day_horizon}</p>
                  <div className={`h-2 rounded-full mb-2 ${confidenceColor(score.confidence_pct)}`} />
                  <p className="text-lg font-bold text-slate-100">{score.confidence_pct.toFixed(1)}%</p>
                  <p className="text-xs text-slate-500 mt-1">ROC-AUC: {score.roc_auc?.toFixed(3)}</p>
                  {bust && (
                    <p className={`text-xs mt-1 font-medium ${bust.severity === 'critical' ? 'text-red-400' : bust.severity === 'high' ? 'text-orange-400' : 'text-slate-400'}`}>
                      Bust: {bust.bust_probability.toFixed(0)}% ({bust.severity})
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-semibold ${alert ? 'text-red-400' : 'text-slate-200'}`}>{value}</p>
    </div>
  );
}
