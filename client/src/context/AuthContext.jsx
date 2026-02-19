import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { account, isConfigured } from '@/lib/appwrite';
import { OAuthProvider } from 'appwrite';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    // Skip SDK calls if env vars are not configured
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    try {
      const u = await account.get();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const loginWithGoogle = () => {
    if (!isConfigured) return;
    account.createOAuth2Session(
      OAuthProvider.Google,
      `${window.location.origin}/home`,
      `${window.location.origin}/login?error=oauth`,
    );
  };

  const logout = async () => {
    if (!isConfigured) return;
    try { await account.deleteSession('current'); } catch {}
    setUser(null);
  };

  const getJWT = async () => {
    if (!isConfigured) return null;
    try {
      const jwt = await account.createJWT();
      return jwt.jwt;
    } catch { return null; }
  };

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, getJWT, refetch: fetchUser, isConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
