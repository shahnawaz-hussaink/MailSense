import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Mail, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import { syncEmails } from '@/services/api';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function QuickQueryCard({ query }) {
  return (
    <Link
      to={`/emails?q=${encodeURIComponent(query)}`}
      className="card px-4 py-3 flex items-center gap-3 hover:border-brand-600/40
                 hover:bg-brand-600/5 transition-all duration-150 group cursor-pointer"
    >
      <Sparkles size={14} className="text-brand-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
      <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors">{query}</span>
    </Link>
  );
}

const QUICK_QUERIES = [
  "Find McDonald's bills",
  "Show OTPs from yesterday",
  "Summarize job emails",
  "Find flight booking confirmations",
  "Total spend this month",
  "Show unread subscription emails",
];

export default function HomePage() {
  const { user, getJWT }         = useAuth();
  const [syncing, setSyncing]    = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const jwt  = await getJWT();
      const data = await syncEmails(jwt);
      setSyncResult({ ok: true, msg: `Sync complete — ${data.stats?.stored ?? 0} new emails added.` });
    } catch (e) {
      const code = e?.response?.status;
      setSyncResult({
        ok:  false,
        msg: code === 409
          ? 'Sync already in progress. Please wait a moment.'
          : 'Sync failed. Check your connection and try again.',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">
            Good {timeOfDay()}, {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="page-subtitle">Here&apos;s your email intelligence overview.</p>
        </div>
        <Button onClick={handleSync} loading={syncing} variant="primary" className="flex-shrink-0">
          <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Sync Inbox'}
        </Button>
      </div>

      {/* Sync banner */}
      {syncResult && (
        <div className={`rounded-lg px-4 py-3 text-sm border animate-slide-up
          ${syncResult.ok
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            : 'bg-red-500/10 border-red-500/25 text-red-400'}`}>
          {syncResult.msg}
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard icon={Mail}       label="Emails synced"    value="—" color="bg-blue-500/15 text-blue-400" />
        <StatCard icon={Sparkles}   label="Entities found"   value="—" color="bg-brand-500/15 text-brand-400" />
        <StatCard icon={TrendingUp} label="Spend this month" value="—" color="bg-emerald-500/15 text-emerald-400" />
      </div>

      {/* ── Quick queries ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock size={15} className="text-slate-500" />
          <h2 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Try asking</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {QUICK_QUERIES.map(q => <QuickQueryCard key={q} query={q} />)}
        </div>
      </div>

      {/* ── CTA bands ── */}
      <div className="card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-slate-100">Upgrade to Premium</p>
          <p className="text-xs text-slate-400 mt-0.5">
            Unlock AI queries, spend analytics, and CSV export.
          </p>
        </div>
        <Link to="/dashboard">
          <Button variant="primary" size="sm">View plans</Button>
        </Link>
      </div>
    </div>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
