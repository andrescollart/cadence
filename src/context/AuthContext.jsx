import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check auth status on mount and when URL changes (after OAuth callback)
  const checkAuthStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/status');
      const data = await response.json();

      if (data.authenticated) {
        setUser(data.user);
        setError(null);
      } else {
        setUser(null);
        if (data.expired) {
          // Try to refresh the token
          await refreshToken();
        }
      }
    } catch (err) {
      console.error('Auth status check failed:', err);
      setUser(null);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh the access token
  const refreshToken = async () => {
    try {
      const response = await fetch('/api/auth/refresh', { method: 'POST' });
      if (response.ok) {
        await checkAuthStatus();
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error('Token refresh failed:', err);
      setUser(null);
    }
  };

  // Login - redirect to OAuth
  const login = () => {
    window.location.href = '/api/auth/login';
  };

  // Logout - clear session
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();

    // Also check when returning from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    if (authStatus) {
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      if (authStatus === 'success') {
        checkAuthStatus();
      } else if (authStatus === 'error') {
        setError(urlParams.get('message') || 'Authentication failed');
      }
    }
  }, [checkAuthStatus]);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    refreshToken,
    checkAuthStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
