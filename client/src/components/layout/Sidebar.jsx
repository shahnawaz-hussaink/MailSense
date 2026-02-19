import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Mail, Home, LogOut, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { to: '/home',      icon: Home,            label: 'Home'      },
  { to: '/emails',    icon: Mail,            label: 'Emails'    },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="fixed left-0 top-0 h-screen w-[var(--sidebar-width)] flex flex-col
                      bg-surface-900 border-r border-surface-800 z-30">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-surface-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600
                          flex items-center justify-center shadow-glow-sm flex-shrink-0">
            <Zap size={15} className="text-white" fill="currentColor" />
          </div>
          <span className="font-semibold text-base tracking-tight text-slate-100">MailSense</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
               transition-all duration-150 group
               ${isActive
                 ? 'bg-brand-600/20 text-brand-400 shadow-[inset_0_0_0_1px_rgba(100,112,243,0.2)]'
                 : 'text-slate-400 hover:text-slate-100 hover:bg-surface-800'}
              `}
          >
            <Icon size={17} className="flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-surface-800">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          {user?.prefs?.avatarUrl ? (
            <img src={user.prefs.avatarUrl} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="avatar" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-brand-700 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-white uppercase">
                {user?.name?.[0] || user?.email?.[0] || 'U'}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-200 truncate">{user?.name || 'User'}</p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10
                       rounded-md transition-colors"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
