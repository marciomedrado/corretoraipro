import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import { User } from './types';
import { getCurrentUser, logout } from './services/authService';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'admin'>('dashboard');

  useEffect(() => {
    const initSession = async () => {
      try {
        // This now auto-logs in the admin or returns a bypass user
        const user = await getCurrentUser();
        if (user) {
          setCurrentUser(user);
          if (user.role === 'admin') {
            setCurrentView('admin');
          }
        }
      } catch (error) {
        console.error("Error loading session:", error);
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, []);

  const handleLogout = async () => {
    await logout();
    // Logout will reload the page, restarting the auto-login process if configured
  };

  const handleUserUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Iniciando CorrectorAI...</p>
        </div>
      </div>
    );
  }

  // If for some reason we still don't have a user (shouldn't happen with bypass), show error
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Erro ao carregar usuário. Tente recarregar a página.
      </div>
    );
  }

  if (currentUser.role === 'admin' && currentView === 'admin') {
    return (
      <AdminPanel 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        onNavigateToApp={() => setCurrentView('dashboard')}
      />
    );
  }

  return (
    <Dashboard 
        user={currentUser} 
        onLogout={handleLogout} 
        onUserUpdate={handleUserUpdate}
        onNavigateToAdmin={currentUser.role === 'admin' ? () => setCurrentView('admin') : undefined}
    />
  );
};

export default App;