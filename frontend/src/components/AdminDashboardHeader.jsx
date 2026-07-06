function AdminDashboardHeader({ adminEmail, onMarket, onLogout, onClose }) {
  return (
    <header className="admin-dashboard-header">
      <div>
        <p className="panel-kicker">Gerçek SQLite satış verileri</p>
        <h2 id="admin-dashboard-title">Yönetim ve Analitik Paneli</h2>
        <small>
          Demo admin ekranıdır; production ortamında yetkilendirme gerekir.
        </small>
      </div>
      <div className="admin-dashboard-actions">
        {adminEmail && <span>{adminEmail}</span>}
        {onMarket && (
          <button className="text-button" type="button" onClick={onMarket}>
            Markete Dön
          </button>
        )}
        {onLogout && (
          <button className="text-button" type="button" onClick={onLogout}>
            Çıkış Yap
          </button>
        )}
        <button className="text-button" type="button" onClick={onClose}>
          Kapat
        </button>
      </div>
    </header>
  );
}

export default AdminDashboardHeader;

