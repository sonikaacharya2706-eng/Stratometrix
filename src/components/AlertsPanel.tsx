import { useState, useMemo } from 'react';
import { Region, Alert } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';
import { Bell, BellOff, CheckCircle, AlertTriangle, AlertOctagon, Info, Send, MessageSquare, Webhook } from 'lucide-react';

interface Props {
  alerts: Alert[];
  regions: Region[];
  isForecaster: boolean;
}

function severityConfig(severity: string) {
  switch (severity) {
    case 'critical': return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-800/50', icon: <AlertOctagon className="w-5 h-5" /> };
    case 'high': return { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-800/50', icon: <AlertTriangle className="w-5 h-5" /> };
    case 'moderate': return { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-800/50', icon: <AlertTriangle className="w-5 h-5" /> };
    case 'low': return { color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-800/50', icon: <Info className="w-5 h-5" /> };
    default: return { color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-700', icon: <Info className="w-5 h-5" /> };
  }
}

function channelIcon(channel: string) {
  switch (channel) {
    case 'sms': return <MessageSquare className="w-3.5 h-3.5" />;
    case 'webhook': return <Webhook className="w-3.5 h-3.5" />;
    default: return <Bell className="w-3.5 h-3.5" />;
  }
}

export default function AlertsPanel({ alerts, regions, isForecaster }: Props) {
  const [filter, setFilter] = useState<'all' | 'unack' | 'ack'>('all');
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'unack') return alerts.filter((a) => !a.acknowledged);
    if (filter === 'ack') return alerts.filter((a) => a.acknowledged);
    return alerts;
  }, [alerts, filter]);

  const stats = useMemo(() => ({
    total: alerts.length,
    unack: alerts.filter((a) => !a.acknowledged).length,
    critical: alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length,
    high: alerts.filter((a) => a.severity === 'high' && !a.acknowledged).length,
  sms: alerts.filter((a) => a.channel === 'sms').length,
    webhook: alerts.filter((a) => a.channel === 'webhook').length,
  app: alerts.filter((a) => a.channel === 'app').length,
  }), [alerts]);

  const handleAcknowledge = async (alertId: string) => {
    setAcknowledging(alertId);
    const { error } = await supabase
      .from('alerts')
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq('id', alertId);
    if (error) console.error('Ack error:', error);
    setAcknowledging(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-1">Alerts & Notifications</h2>
        <p className="text-slate-400 text-sm">
          Automated risk alerts dispatched to stakeholders via app notifications, SMS,
          or API webhooks. Acknowledge alerts to track operational response.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-2"><Bell className="w-4 h-4" /> Total Alerts</div>
          <p className="text-2xl font-bold text-slate-100">{stats.total}</p>
        </div>
        <div className="p-4 rounded-xl border border-red-800/50 bg-slate-900/50">
          <div className="flex items-center gap-2 text-red-400 text-xs mb-2"><AlertOctagon className="w-4 h-4" /> Critical Unack</div>
          <p className="text-2xl font-bold text-red-400">{stats.critical}</p>
        </div>
        <div className="p-4 rounded-xl border border-orange-800/50 bg-slate-900/50">
          <div className="flex items-center gap-2 text-orange-400 text-xs mb-2"><AlertTriangle className="w-4 h-4" /> High Unack</div>
          <p className="text-2xl font-bold text-orange-400">{stats.high}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-2 text-slate-400 text-xs mb-2"><BellOff className="w-4 h-4" /> Unacknowledged</div>
          <p className="text-2xl font-bold text-slate-100">{stats.unack}</p>
        </div>
      </div>

      {/* Channel distribution */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">Channels:</span>
        <span className="flex items-center gap-1.5 text-slate-300"><Bell className="w-4 h-4 text-sky-400" /> App: {stats.app}</span>
        <span className="flex items-center gap-1.5 text-slate-300"><MessageSquare className="w-4 h-4 text-emerald-400" /> SMS: {stats.sms}</span>
        <span className="flex items-center gap-1.5 text-slate-300"><Webhook className="w-4 h-4 text-purple-400" /> Webhook: {stats.webhook}</span>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {(['all', 'unack', 'ack'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
              filter === f
                ? 'bg-sky-500/20 border-sky-500 text-sky-300'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
          >
            {f === 'all' ? 'All' : f === 'unack' ? 'Unacknowledged' : 'Acknowledged'}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <BellOff className="w-12 h-12 mx-auto mb-3 text-slate-700" />
            <p>No alerts in this category.</p>
          </div>
        )}
        {filtered.map((alert) => {
          const sev = severityConfig(alert.severity);
          const region = regions.find((r) => r.id === alert.region_id);
          return (
            <div
              key={alert.id}
              className={`p-4 rounded-xl border ${sev.border} ${sev.bg} ${alert.acknowledged ? 'opacity-60' : ''} transition`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 ${sev.color}`}>{sev.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="font-semibold text-slate-100">{alert.title}</h4>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${sev.bg} ${sev.color} border ${sev.border}`}>
                      {alert.severity}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      {channelIcon(alert.channel)} {alert.channel}
                    </span>
                    {region && <span className="text-xs text-slate-500">· {region.name}</span>}
                  </div>
                  <p className="text-sm text-slate-300">{alert.message}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {new Date(alert.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {alert.acknowledged ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Acknowledged</span>
                    </div>
                  ) : isForecaster ? (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={acknowledging === alert.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 hover:border-emerald-600 hover:text-emerald-400 text-slate-300 text-sm transition disabled:opacity-50"
                    >
                      {acknowledging === alert.id ? (
                        <span className="animate-pulse">Acknowledging…</span>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Acknowledge</span>
                        </>
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
