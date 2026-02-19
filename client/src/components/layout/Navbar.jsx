import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const PAGE_TITLES = {
  '/home':      { title: 'Home',      subtitle: 'Your inbox overview' },
  '/emails':    { title: 'Emails',    subtitle: 'Search and query your inbox' },
  '/dashboard': { title: 'Dashboard', subtitle: 'Account, subscription, and settings' },
};

export default function Navbar() {
  const { user }    = useAuth();
  const { pathname } = useLocation();
  const current     = PAGE_TITLES[pathname] || { title: 'MailSense', subtitle: '' };

  return (
    <header className="fixed top-0 left-[var(--sidebar-width)] right-0 h-16 z-20
                       flex items-center justify-between px-6
                       bg-surface-950/80 backdrop-blur-md border-b border-surface-800">
      {/* Page title */}
      <div>
        <h1 className="text-base font-semibold text-slate-100">{current.title}</h1>
        {current.subtitle && (
          <p className="text-xs text-slate-500">{current.subtitle}</p>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2">
        <button className="btn-ghost p-2 text-slate-400 hover:text-slate-200 rounded-lg">
          <Bell size={17} />
        </button>

        {user?.prefs?.avatarUrl ? (
          <img
            src={user.prefs.avatarUrl}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-surface-700"
            alt="avatar"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center
                          ring-2 ring-brand-600/30">
            <span className="text-sm font-semibold text-white uppercase">
              {user?.name?.[0] || user?.email?.[0] || 'U'}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
