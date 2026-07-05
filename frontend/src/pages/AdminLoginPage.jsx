import { useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAdminAuth } from "../hooks/useAdminAuth.js";

function AdminLoginPage() {
  const { login, isAuthLoading, isAuthenticated, authError } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submitting = useRef(false);
  const navigate = useNavigate();

  if (isAuthenticated) return <Navigate to="/admin" replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    try {
      await login(email, password);
      navigate("/admin", { replace: true });
    } catch {
      // Güvenli genel hata context üzerinden gösterilir.
    } finally {
      submitting.current = false;
    }
  }

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <div className="brand-mark" aria-hidden="true">EM</div>
        <div>
          <p className="panel-kicker">Güvenli yönetim alanı</p>
          <h1>Admin Girişi</h1>
        </div>
        <label>E-posta
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>Parola
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {authError && <div className="alert" role="alert">{authError}</div>}
        <button type="submit" disabled={isAuthLoading}>
          {isAuthLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>
        <Link to="/">← Market ekranına dön</Link>
      </form>
    </main>
  );
}

export default AdminLoginPage;
