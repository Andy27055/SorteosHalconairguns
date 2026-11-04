import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { User } from './types';
import { api, ApiError, post, setBearer } from './api';
import { Loading } from './components/UI';
interface Auth { user: User | null; loading: boolean; error: string; retry: () => Promise<void>; accept: (result: { user: User; token: string }) => void; logout: () => Promise<void> }
const Context = createContext<Auth | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const retry = useCallback(async () => {
    setLoading(true); setError('');
    try { setUser((await api<{ user: User }>('/auth/me')).user); }
    catch (err) { setUser(null); if (!(err instanceof ApiError && err.status === 401)) setError(err instanceof Error ? err.message : 'No pudimos recuperar tu sesión.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void retry(); const reset = () => { setUser(null); setBearer(''); }; window.addEventListener('session-expired', reset); return () => window.removeEventListener('session-expired', reset); }, [retry]);
  const accept = (result: { user: User; token: string }) => { setBearer(result.token); setUser(result.user); setError(''); };
  const logout = async () => { await post('/auth/logout'); setBearer(''); setUser(null); };
  return <Context.Provider value={{ user, loading, error, retry, accept, logout }}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('Falta AuthProvider.'); return value; }
export function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading, error, retry } = useAuth(); const location = useLocation();
  if (loading) return <Loading />;
  if (error) return <div className="panel"><p role="alert">{error}</p><button className="btn btn-primary" onClick={() => void retry()}>Reintentar</button></div>;
  if (!user) return <Navigate to="/ingresar" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/sin-permiso" replace />;
  return <>{children}</>;
}
