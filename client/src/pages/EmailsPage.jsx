import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Sparkles, ChevronRight, Lock, X, Loader } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { databases, DB_ID } from '@/lib/appwrite';
import { Query } from 'appwrite';
import { runAiQuery } from '@/services/api';
import EntityBadge from '@/components/ui/EntityBadge';
import Button from '@/components/ui/Button';
import PremiumUpgradeModal from '@/components/PremiumUpgradeModal';

// ─── Email Card ───────────────────────────────────────────────────────────────
function EmailCard({ email, isSelected, onClick }) {
  const date = new Date(email.timestamp);
  const ago  = formatAgo(date);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-surface-800/60 hover:bg-surface-800/40
                  transition-colors duration-100 cursor-pointer
                  ${isSelected ? 'bg-brand-600/10 border-l-2 border-l-brand-500 pl-3.5' : ''}`}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <p className="text-sm font-medium text-slate-200 truncate flex-1">{email.subject || '(No subject)'}</p>
        <span className="text-[11px] text-slate-500 flex-shrink-0">{ago}</span>
      </div>
      <p className="text-xs text-slate-500 truncate">{email.from}</p>
      {email.snippet && (
        <p className="text-xs text-slate-500/80 truncate mt-1">{email.snippet}</p>
      )}
    </button>
  );
}

// ─── Email Detail ─────────────────────────────────────────────────────────────
function EmailDetail({ email, entities, onClose }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-slate-100 text-base leading-snug">{email.subject || '(No subject)'}</h2>
          <p className="text-xs text-slate-500 mt-1">From: {email.from}</p>
          <p className="text-xs text-slate-600">{new Date(email.timestamp).toLocaleString()}</p>
        </div>
        <button onClick={onClose} className="btn-ghost p-1 text-slate-500 rounded-md flex-shrink-0">
          <X size={16} />
        </button>
      </div>

      {entities.length > 0 && (
        <div className="mb-4 p-3.5 bg-brand-600/5 border border-brand-600/20 rounded-lg">
          <p className="text-xs font-medium text-brand-400 uppercase tracking-wider mb-2.5">Extracted Data</p>
          <div className="flex flex-wrap gap-2">
            {entities.map((e, i) => <EntityBadge key={i} type={e.type} value={e.value} />)}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <pre className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed font-mono">
          {email.body || email.snippet || 'No content'}
        </pre>
      </div>
    </div>
  );
}

// ─── AI Query Box ─────────────────────────────────────────────────────────────
function AIQueryBox({ isPremium, onResult, isLoading }) {
  const [query, setQuery] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [error, setError] = useState('');
  const { getJWT }        = useAuth();

  const suggestions = [
    "Find McDonald's bills",
    "Show OTPs from yesterday",
    "Summarize job emails",
    "Total spend this month",
  ];

  const submit = async (q) => {
    if (!isPremium) { setShowUpgrade(true); return; }
    if (!q.trim()) return;
    setError('');
    try {
      const jwt  = await getJWT();
      const data = await runAiQuery(jwt, q.trim());
      onResult(data);
    } catch (e) {
      setError(e?.response?.data?.error || 'Query failed. Please try again.');
    }
  };

  return (
    <>
      <div className="mb-5">
        <div className="relative">
          <Sparkles size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit(query)}
            placeholder={isPremium ? 'Ask anything about your emails…' : 'Upgrade to Premium to use AI queries'}
            disabled={isLoading}
            className="input pl-9 pr-12"
          />
          {query && (
            <button
              onClick={() => submit(query)}
              disabled={isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-brand-400
                         hover:text-brand-300 transition-colors rounded-md"
            >
              {isLoading ? <Loader size={15} className="animate-spin" /> : <ChevronRight size={15} />}
            </button>
          )}
        </div>

        {!isPremium && (
          <button
            onClick={() => setShowUpgrade(true)}
            className="mt-2 flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            <Lock size={11} />Upgrade to Premium to unlock AI queries
          </button>
        )}

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        {/* Suggestions */}
        <div className="flex flex-wrap gap-2 mt-3">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => { setQuery(s); submit(s); }}
              className="text-xs px-2.5 py-1 rounded-full bg-surface-800 text-slate-400
                         hover:bg-brand-600/15 hover:text-brand-400 border border-surface-700
                         hover:border-brand-600/30 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <PremiumUpgradeModal isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>
  );
}

// ─── AI Result Panel ──────────────────────────────────────────────────────────
function AIResultPanel({ result }) {
  if (!result) return null;
  return (
    <div className="mb-5 card p-4 border-brand-600/30 animate-slide-up">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={13} className="text-brand-400" />
        <span className="text-xs font-medium text-brand-400 uppercase tracking-wider">AI Answer</span>
      </div>
      <p className="text-sm text-slate-200 leading-relaxed">{result.answer}</p>
      {result.data?.total != null && (
        <p className="text-xs text-slate-500 mt-2">
          Total: <span className="font-mono text-slate-300">₹{result.data.total}</span>
          {' · '}{result.data.count} records
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const COL_EMAILS    = 'emails';
const COL_ENTITIES  = 'extracted_entities';

export default function EmailsPage() {
  const { user, getJWT }          = useAuth();
  const [params, setParams]       = useSearchParams();
  const [search, setSearch]       = useState(params.get('q') || '');
  const [emails, setEmails]       = useState([]);
  const [emailsLoading, setEL]    = useState(false);
  const [selected, setSelected]   = useState(null);
  const [entities, setEntities]   = useState([]);
  const [aiResult, setAiResult]   = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const isPremium                 = user?.prefs?.plan === 'premium';

  // Fetch emails from Appwrite directly
  const fetchEmails = useCallback(async () => {
    setEL(true);
    try {
      const queries = [
        Query.orderDesc('timestamp'),
        Query.limit(40),
      ];
      if (search.trim()) {
        queries.push(Query.search('subject', search.trim()));
      }
      const res = await databases.listDocuments(DB_ID, COL_EMAILS, queries);
      setEmails(res.documents);
    } catch { setEmails([]); }
    finally { setEL(false); }
  }, [search]);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  // Pre-fill query from URL param
  useEffect(() => {
    const q = params.get('q');
    if (q) { setSearch(q); handleAiQuery(q); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAiQuery = async (q) => {
    setAiLoading(true);
    try {
      const jwt  = await getJWT();
      const data = await runAiQuery(jwt, q || search);
      setAiResult(data);
    } catch { setAiResult(null); }
    finally { setAiLoading(false); }
  };

  const selectEmail = async (email) => {
    setSelected(email);
    try {
      const res = await databases.listDocuments(DB_ID, COL_ENTITIES, [
        Query.equal('emailId', email.$id),
        Query.limit(20),
      ]);
      setEntities(res.documents);
    } catch { setEntities([]); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="page-title">Emails</h1>
        <p className="page-subtitle">Search your inbox or ask an AI question.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setParams(e.target.value ? { q: e.target.value } : {}); }}
          onKeyDown={e => e.key === 'Enter' && fetchEmails()}
          placeholder="Search by subject…"
          className="input pl-9"
        />
      </div>

      {/* AI Query */}
      <AIQueryBox isPremium={isPremium} onResult={setAiResult} isLoading={aiLoading} />
      <AIResultPanel result={aiResult} />

      {/* Email list + detail */}
      <div className="card overflow-hidden flex" style={{ minHeight: 480 }}>
        {/* List pane */}
        <div className={`flex flex-col border-r border-surface-800 ${selected ? 'w-2/5' : 'w-full'}`}>
          {emailsLoading ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="text-center text-slate-500 text-sm">Loading…</div>
            </div>
          ) : emails.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-slate-500">
              <Mail size={32} className="mb-3 opacity-30" />
              <p className="text-sm">{search ? 'No results found.' : 'No emails synced yet.'}</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {emails.map(email => (
                <EmailCard
                  key={email.$id}
                  email={email}
                  isSelected={selected?.$id === email.$id}
                  onClick={() => selectEmail(email)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail pane */}
        {selected && (
          <div className="flex-1 p-5 overflow-hidden">
            <EmailDetail email={selected} entities={entities} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

function formatAgo(date) {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)   return `${d}d ago`;
  return date.toLocaleDateString();
}

// A simple import for the Mail icon used in empty state
function Mail({ size, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
}
