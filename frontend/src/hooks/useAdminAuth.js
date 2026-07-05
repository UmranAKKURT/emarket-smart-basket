import { useContext } from "react";

import { AdminAuthContext } from "../context/AdminAuthContext.jsx";

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth, AdminAuthProvider içinde kullanılmalıdır.");
  return context;
}
