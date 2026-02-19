import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }   from '@/context/AuthContext';
import ProtectedRoute     from '@/components/ProtectedRoute';
import AppLayout          from '@/components/layout/AppLayout';
import LoginPage          from '@/pages/LoginPage';
import HomePage           from '@/pages/HomePage';
import EmailsPage         from '@/pages/EmailsPage';
import DashboardPage      from '@/pages/DashboardPage';
import { isConfigured }   from '@/lib/appwrite';

// ─── Setup screen shown when .env vars are placeholders ───────────────────────
function SetupScreen() {
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6 animate-slide-up">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600
                          flex items-center justify-center text-white font-bold">M</div>
          <span className="text-xl font-semibold text-slate-100">MailSense</span>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚙️</span>
            <h1 className="font-semibold text-amber-300">Setup Required</h1>
          </div>
          <p className="text-sm text-amber-200/70">
            Your <code className="font-mono bg-amber-500/15 px-1 rounded">client/.env</code> file
            is missing a valid Appwrite Project ID. Fill in the values below and restart the dev server.
          </p>
        </div>

        <div className="bg-surface-900 border border-surface-800 rounded-xl p-5 space-y-3">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">client/.env</p>
          <pre className="text-sm text-slate-300 font-mono leading-relaxed overflow-x-auto">{`VITE_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=<your-project-id>
VITE_APPWRITE_DATABASE_ID=mailsense_db

VITE_FN_SYNC_EMAILS_URL=<function-url>/executions
VITE_FN_AI_QUERY_URL=<function-url>/executions
VITE_FN_DELETE_ACCOUNT_URL=<function-url>/executions

VITE_STRIPE_PAYMENT_LINK=<stripe-payment-link>`}</pre>
        </div>

        <p className="text-xs text-slate-500">
          Get your Project ID from{' '}
          <a href="https://cloud.appwrite.io" target="_blank" rel="noreferrer"
             className="text-brand-400 hover:text-brand-300 underline">
            cloud.appwrite.io
          </a>
          {' '}→ Settings → Project ID
        </p>
      </div>
    </div>
  );
}

// ─── Private page wrapper ─────────────────────────────────────────────────────
function PrivatePage({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>
        {children}
      </AppLayout>
    </ProtectedRoute>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  // Show setup helper when env vars are not configured
  if (!isConfigured) return <SetupScreen />;

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login"     element={<LoginPage />} />
          <Route path="/home"      element={<PrivatePage><HomePage /></PrivatePage>} />
          <Route path="/emails"    element={<PrivatePage><EmailsPage /></PrivatePage>} />
          <Route path="/dashboard" element={<PrivatePage><DashboardPage /></PrivatePage>} />
          <Route path="/"          element={<Navigate to="/login" replace />} />
          <Route path="*"          element={<Navigate to="/home"  replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
