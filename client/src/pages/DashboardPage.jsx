import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Crown, Shield, Trash2, LogOut, ChevronRight, CreditCard } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import PremiumUpgradeModal from '@/components/PremiumUpgradeModal';
import { deleteAccount } from '@/services/api';

// ─── Plan badge ───────────────────────────────────────────────────────────────
function PlanBadge({ plan }) {
  return plan === 'premium' ? (
    <span className="badge bg-amber-500/15 text-amber-400 border border-amber-500/25">
      <Crown size={10} fill="currentColor" />Premium
    </span>
  ) : (
    <span className="badge bg-surface-700/40 text-slate-400 border border-surface-700">
      Free
    </span>
  );
}

// ─── Setting row ──────────────────────────────────────────────────────────────
function SettingRow({ icon: Icon, label, desc, onClick, danger = false }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-150 text-left
        ${danger
          ? 'hover:bg-red-500/10 group'
          : 'hover:bg-surface-800/60 group'}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
        ${danger
          ? 'bg-red-500/15 text-red-400 group-hover:bg-red-500/25'
          : 'bg-surface-800 text-slate-400 group-hover:bg-brand-600/15 group-hover:text-brand-400'}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? 'text-red-400' : 'text-slate-200'}`}>{label}</p>
        {desc && <p className="text-xs text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <ChevronRight size={15} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0" />
    </button>
  );
}

// ─── Delete confirmation modal ────────────────────────────────────────────────
function DeleteAccountModal({ isOpen, onClose }) {
  const { getJWT, logout } = useAuth();
  const navigate           = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [confirm, setConfirm] = useState('');

  const handleDelete = async () => {
    if (confirm !== 'DELETE') return;
    setLoading(true);
    setError('');
    try {
      const jwt = await getJWT();
      await deleteAccount(jwt);
      await logout();
      navigate('/login');
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to delete account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Account" maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="bg-red-500/10 border border-red-500/25 rounded-lg p-3.5 text-sm text-red-300 leading-relaxed">
          ⚠️ This will permanently delete all your emails, extracted entities, subscriptions, and account data.
          This action <strong>cannot be undone</strong>.
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Type <code className="font-mono text-red-400 bg-red-500/10 px-1 py-0.5 rounded">DELETE</code> to confirm
          </label>
          <input
            type="text"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="input"
            placeholder="DELETE"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={loading}
            disabled={confirm !== 'DELETE'}
            className="flex-1 justify-center"
          >
            Delete Account
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, logout }           = useAuth();
  const navigate                   = useNavigate();
  const [showUpgrade, setUpgrade]  = useState(false);
  const [showDelete, setDelete]    = useState(false);

  const plan     = user?.prefs?.plan || 'free';
  const initials = (user?.name || user?.email || 'U')[0].toUpperCase();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* ── Header ── */}
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Manage your account, subscription, and privacy settings.</p>
      </div>

      {/* ── Profile card ── */}
      <div className="card p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-600 to-violet-700
                        flex items-center justify-center text-2xl font-bold text-white flex-shrink-0
                        shadow-glow-brand">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-100">{user?.name || 'User'}</h2>
            <PlanBadge plan={plan} />
          </div>
          <p className="text-sm text-slate-400 mt-0.5">{user?.email}</p>
          <p className="text-xs text-slate-600 mt-1 font-mono">ID: {user?.$id}</p>
        </div>
      </div>

      {/* ── Subscription ── */}
      <div className="card p-1.5">
        <div className="px-4 py-3 border-b border-surface-800">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Subscription</p>
        </div>

        {plan === 'free' ? (
          <div className="p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-200">Free Plan</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Upgrade for AI queries, spend analytics, and unlimited sync.
              </p>
            </div>
            <Button onClick={() => setUpgrade(true)} variant="primary" size="sm" className="flex-shrink-0">
              <Crown size={13} fill="currentColor" />
              Upgrade
            </Button>
          </div>
        ) : (
          <SettingRow
            icon={CreditCard}
            label="Premium Active"
            desc="Manage billing on Stripe"
            onClick={() => window.open('https://billing.stripe.com/p/login/test', '_blank')}
          />
        )}
      </div>

      {/* ── Account settings ── */}
      <div className="card p-1.5">
        <div className="px-4 py-3 border-b border-surface-800">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Account</p>
        </div>
        <div className="divide-y divide-surface-800/50">
          <SettingRow
            icon={Shield}
            label="Privacy & Data"
            desc="View how your data is stored and processed"
            onClick={() => {}}
          />
          <SettingRow
            icon={LogOut}
            label="Sign Out"
            desc="Sign out from this device"
            onClick={handleLogout}
          />
        </div>
      </div>

      {/* ── Danger zone ── */}
      <div className="card p-1.5 border-red-700/20">
        <div className="px-4 py-3 border-b border-red-700/20">
          <p className="text-xs font-medium text-red-500/70 uppercase tracking-wider">Danger Zone</p>
        </div>
        <SettingRow
          icon={Trash2}
          label="Delete Account"
          desc="Permanently erase all account data (GDPR)"
          onClick={() => setDelete(true)}
          danger
        />
      </div>

      <PremiumUpgradeModal isOpen={showUpgrade} onClose={() => setUpgrade(false)} />
      <DeleteAccountModal  isOpen={showDelete}  onClose={() => setDelete(false)}  />
    </div>
  );
}
