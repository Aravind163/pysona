import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { SessionScreen } from './features/Home/SessionScreen';
import { SessionEndScreen } from './features/Home/SessionEndScreen';
import { SessionHistory } from './features/Sessions/SessionHistory';
import { SessionDetailScreen } from './features/Sessions/SessionDetailScreen';
import { PlansScreen } from './features/Plans/PlansScreen';
import { AccountScreen } from './features/Account/AccountScreen';
import { LoginScreen } from './features/Auth/LoginScreen';
import { OnboardingScreen } from './features/Onboarding/OnboardingScreen';
import { AdminDashboard } from './features/Admin/AdminDashboard';
import { BottomNav } from './components/Layout/BottomNav';
import { Sidebar } from './components/Layout/Sidebar';
import { ToastContext } from './hooks/useToast';
import { ToastContainer } from './components/UI/ToastContainer';
import { PageLoader } from './components/UI/PageLoader';
import { UserProfile, AppPlan } from './types';
import api, { setToken } from './lib/api';
import { connectSocket, disconnectSocket } from './lib/socket';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  logout: () => void;
  updateUser: (partial: Partial<UserProfile>) => void;
  syncUser: () => Promise<void>;
  handleAuthSuccess: (token: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null, isAuthenticated: false,
  logout: () => {}, updateUser: () => {},
  syncUser: async () => {}, handleAuthSuccess: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const AppRoutes = () => {
  const { user } = useAuth();
  const [isPageLoading, setIsPageLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsPageLoading(true);
    const t = setTimeout(() => setIsPageLoading(false), 350);
    return () => clearTimeout(t);
  }, [location.pathname]);

  const needsOnboarding = user?.plan === AppPlan.STANDARD && !user?.hasCompletedOnboarding;
  if (needsOnboarding && location.pathname !== '/onboarding' && location.pathname !== '/plans') {
    return <Navigate to="/onboarding" replace />;
  }

  const hideNav = ['/onboarding'].includes(location.pathname);
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col md:flex-row overflow-x-hidden">
      {!hideNav && <Sidebar />}
      <main className={`flex-1 transition-all duration-300 relative ${!hideNav ? 'md:ml-64 pb-16 md:pb-0' : ''}`}>
        {!hideNav && <PageLoader loading={isPageLoading} />}
        <Routes>
          <Route path="/" element={<SessionScreen />} />
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="/session-end" element={<SessionEndScreen />} />
          <Route path="/sessions" element={<SessionHistory />} />
          <Route path="/sessions/:id" element={<SessionDetailScreen />} />
          <Route path="/plans" element={<PlansScreen />} />
          <Route path="/account" element={<AccountScreen />} />
          {isAdmin && <Route path="/admin" element={<AdminDashboard />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
};

const App = () => {
  const [toasts, setToasts] = useState<any[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleAuthSuccess = useCallback(async (newToken: string) => {
    setToken(newToken);
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      // Realtime: connect socket, listen for credit changes
      const sock = connectSocket(newToken);
      sock.off('credits:update');
      sock.on('credits:update', ({ credits }: { credits: number }) => {
        setUser((prev) => prev ? { ...prev, credits } : prev);
      });
    } catch {
      setToken(null);
    }
  }, []);

  // Handle Google OAuth redirect (token comes back as query param)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleToken = params.get('token');
    const provider = params.get('provider');
    const error = params.get('error');
    if (googleToken) {
      handleAuthSuccess(googleToken).then(() => {
        if (provider === 'google') showToast('Signed in with Google!', 'success');
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (error) {
      showToast(error === 'blocked' ? 'Account blocked. Contact support.' : 'Sign-in failed.', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // eslint-disable-line

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    disconnectSocket();
    showToast('Signed out successfully.', 'info');
  }, [showToast]);

  const updateUser = useCallback((partial: Partial<UserProfile>) => {
    setUser((prev) => prev ? { ...prev, ...partial } : prev);
  }, []);

  const syncUser = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
    } catch {}
  }, []);

  return (
    <HashRouter>
      <ToastContext.Provider value={{ showToast, toasts, removeToast }}>
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, logout, updateUser, syncUser, handleAuthSuccess }}>
          {!user
            ? <LoginScreen onAuthSuccess={handleAuthSuccess} />
            : <AppRoutes />
          }
          <ToastContainer />
        </AuthContext.Provider>
      </ToastContext.Provider>
    </HashRouter>
  );
};

export default App;
