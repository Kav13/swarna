import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { api } from '../api';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setupRequired: boolean;
  login: (username: string, pass: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isOwner: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [setupRequired, setSetupRequired] = useState<boolean>(false);

  const refreshCurrentUser = useCallback(async () => {
    try {
      if (window.api) {
        const hasUsers = await window.api.auth.hasAnyUsers();
        if (!hasUsers) {
          setSetupRequired(true);
          setCurrentUser(null);
          setIsLoading(false);
          return;
        }
        setSetupRequired(false);
        const user = await window.api.auth.getCurrentUser();
        setCurrentUser(user);
      }
    } catch (err) {
      console.error('Failed to get current user:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCurrentUser();
  }, [refreshCurrentUser]);

  // Touch user activity on interaction
  useEffect(() => {
    const handleActivity = () => {
      if (currentUser && window.api) {
        window.api.auth.touchActivity();
      }
    };

    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [currentUser]);

  const login = async (username: string, pass: string): Promise<User> => {
    if (!window.api) {
      throw new Error('This app requires Electron desktop runtime with SQLite. Please run "npm run dev:electron" in your terminal to open the desktop application.');
    }
    const user = await window.api.auth.login(username, pass);
    setCurrentUser(user);
    return user;
  };

  const logout = async (): Promise<void> => {
    if (window.api) {
      await window.api.auth.logout();
    }
    setCurrentUser(null);
  };

  const hasPermission = (permission: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'OWNER') return true;
    return Boolean(currentUser.permissions && currentUser.permissions[permission]);
  };

  const isOwner = currentUser?.role === 'OWNER';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: Boolean(currentUser),
        isLoading,
        setupRequired,
        login,
        logout,
        refreshCurrentUser,
        hasPermission,
        isOwner,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
