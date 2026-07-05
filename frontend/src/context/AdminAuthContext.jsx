import { createContext, useCallback, useMemo, useState } from "react";

import { adminLogin, adminLogout, getAdminMe } from "../services/authApi.js";

export const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  const login = useCallback(async (email, password) => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const data = await adminLogin(email, password);
      setAdminUser(data.user);
      return data.user;
    } catch (error) {
      setAdminUser(null);
      setAuthError(error.message);
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsAuthLoading(true);
    try {
      await adminLogout();
    } finally {
      setAdminUser(null);
      setIsAuthLoading(false);
    }
  }, []);

  const refreshAdminSession = useCallback(async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const data = await getAdminMe();
      setAdminUser(data.user);
      return data.user;
    } catch (error) {
      setAdminUser(null);
      setAuthError(error.message);
      throw error;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const value = useMemo(() => ({
    adminUser,
    isAuthLoading,
    isAuthenticated: Boolean(adminUser),
    authError,
    login,
    logout,
    refreshAdminSession
  }), [adminUser, isAuthLoading, authError, login, logout, refreshAdminSession]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
