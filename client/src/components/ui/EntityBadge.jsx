const VARIANTS = {
  price:       'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  merchant:    'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  otp:         'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  flight_pnr:  'bg-violet-500/15 text-violet-400 border border-violet-500/25',
  flight_route:'bg-violet-500/15 text-violet-400 border border-violet-500/25',
  job_status:  'bg-rose-500/15 text-rose-400 border border-rose-500/25',
  job_company: 'bg-rose-500/15 text-rose-400 border border-rose-500/25',
  tracking_num:'bg-cyan-500/15 text-cyan-400 border border-cyan-500/25',
  subscription:'bg-purple-500/15 text-purple-400 border border-purple-500/25',
  date:        'bg-slate-500/15 text-slate-400 border border-slate-500/25',
  custom:      'bg-surface-700/40 text-slate-400 border border-surface-700',
};

const ICONS = {
  price:       '₹',
  merchant:    '🏪',
  otp:         '🔐',
  flight_pnr:  '✈️',
  flight_route:'✈️',
  job_status:  '💼',
  job_company: '🏢',
  tracking_num:'📦',
  subscription:'🔄',
  date:        '📅',
  custom:      '•',
};

export default function EntityBadge({ type, value }) {
  const cls  = VARIANTS[type] || VARIANTS.custom;
  const icon = ICONS[type]    || '•';
  const label = type.replace(/_/g, ' ');

  return (
    <span className={`badge ${cls} capitalize`}>
      <span>{icon}</span>
      <span className="font-medium">{label}:</span>
      <span className="font-mono">{value}</span>
    </span>
  );
}
