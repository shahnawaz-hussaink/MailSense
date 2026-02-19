import { Crown, Check, Zap } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

const FEATURES = [
  'Natural language AI queries',
  'Spend analytics & totals',
  'Entity extraction (OTP, flights, jobs)',
  'Unlimited email sync',
  'Priority support',
];

export default function PremiumUpgradeModal({ isOpen, onClose }) {
  const paymentLink = import.meta.env.VITE_STRIPE_PAYMENT_LINK;

  const handleUpgrade = () => {
    if (paymentLink) window.open(paymentLink, '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upgrade to Premium" maxWidth="max-w-md">
      <div className="space-y-5">
        {/* Price hero */}
        <div className="bg-gradient-to-br from-brand-600/20 to-violet-600/20
                        border border-brand-600/30 rounded-xl p-5 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Crown size={18} className="text-amber-400" fill="currentColor" />
            <span className="font-semibold text-slate-100">MailSense Premium</span>
          </div>
          <div className="mt-3">
            <span className="text-4xl font-bold text-white">₹299</span>
            <span className="text-slate-400 text-sm">/month</span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">or ₹2,999/year · cancel anytime</p>
        </div>

        {/* Features */}
        <ul className="space-y-2.5">
          {FEATURES.map(f => (
            <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
              <span className="w-4.5 h-4.5 rounded-full bg-emerald-500/20 border border-emerald-500/30
                               flex items-center justify-center flex-shrink-0">
                <Check size={10} className="text-emerald-400" strokeWidth={3} />
              </span>
              {f}
            </li>
          ))}
        </ul>

        <div className="flex gap-3 pt-1">
          <Button variant="ghost" onClick={onClose} className="flex-1 justify-center">
            Maybe later
          </Button>
          <Button variant="primary" onClick={handleUpgrade} className="flex-1 justify-center">
            <Zap size={14} fill="currentColor" />
            Upgrade now
          </Button>
        </div>

        <p className="text-center text-[11px] text-slate-600">
          Powered by Stripe · Secure · Cancel anytime
        </p>
      </div>
    </Modal>
  );
}
