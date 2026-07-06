import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { useAdminAuth } from "../hooks/useAdminAuth.js";
import LoadingSpinner from "./LoadingSpinner.jsx";

function ProtectedAdminRoute({ children }) {
  const { isAuthenticated, refreshAdminSession } = useAdminAuth();
  const [checking, setChecking] = useState(!isAuthenticated);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let isActive = true;

    if (isAuthenticated) {
      setChecking(false);
      setDenied(false);
      return () => {
        isActive = false;
      };
    }

    refreshAdminSession()
      .catch((error) => {
        if (isActive) {
          setDenied(error.status === 403 ? "forbidden" : "unauthorized");
        }
      })
      .finally(() => {
        if (isActive) {
          setChecking(false);
        }
      });

    return () => {
      // Geç dönen /me isteğinin unmount sonrası state yazmasını engeller.
      isActive = false;
    };
  }, [isAuthenticated, refreshAdminSession]);

  if (checking) return <div className="admin-route-state"><LoadingSpinner label="Admin oturumu kontrol ediliyor..." /></div>;
  if (denied === "forbidden") return <p className="admin-route-state">Bu alana erişim yetkiniz yok.</p>;
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  return children;
}

export default ProtectedAdminRoute;
