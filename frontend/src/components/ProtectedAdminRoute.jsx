import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAdminAuth } from "../hooks/useAdminAuth.js";

function ProtectedAdminRoute({ children }) {
  const { isAuthenticated, refreshAdminSession } = useAdminAuth();
  const [checking, setChecking] = useState(!isAuthenticated);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      setChecking(false);
      return;
    }
    refreshAdminSession()
      .catch((error) => setDenied(error.status === 403 ? "forbidden" : "unauthorized"))
      .finally(() => setChecking(false));
  }, [isAuthenticated, refreshAdminSession]);

  if (checking) return <p className="admin-route-state">Admin oturumu kontrol ediliyor...</p>;
  if (denied === "forbidden") return <p className="admin-route-state">Bu alana erişim yetkiniz yok.</p>;
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return children;
}

export default ProtectedAdminRoute;
