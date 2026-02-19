import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider }   from '@/context/AuthContext';
import ProtectedRoute     from '@/components/ProtectedRoute';
import AppLayout          from '@/components/layout/AppLayout';
import LoginPage          from '@/pages/LoginPage';
import HomePage           from '@/pages/HomePage';
import EmailsPage         from '@/pages/EmailsPage';
import DashboardPage      from '@/pages/DashboardPage';

function PrivatePage({ children }) {
  return (
    <ProtectedRoute>
      <AppLayout>
        {children}
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login"     element={<LoginPage />} />
          <Route path="/home"      element={<PrivatePage><HomePage /></PrivatePage>} />
          <Route path="/emails"    element={<PrivatePage><EmailsPage /></PrivatePage>} />
          <Route path="/dashboard" element={<PrivatePage><DashboardPage /></PrivatePage>} />
          {/* Default redirect */}
          <Route path="/"          element={<Navigate to="/login" replace />} />
          <Route path="*"          element={<Navigate to="/home"  replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
