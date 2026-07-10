import { formatCurrency } from "../utils/currency.js";
import LoadingSpinner from "./LoadingSpinner.jsx";

function OrderDetail({ detail, loading, error, onBack, onClose }) {
  return (
    <div className="order-panel-backdrop" role="presentation">
      <section
        className="order-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
        tabIndex={-1}
      >
        <div className="order-panel-header">
          <button className="text-button" type="button" onClick={onBack}>
            ← Geri dön
          </button>
          <button className="text-button" type="button" onClick={onClose}>
            Kapat
          </button>
        </div>

        {loading && (
          <div className="order-panel-state">
            <LoadingSpinner label="Sipariş detayı yükleniyor..." />
          </div>
        )}

        {!loading && error && (
          <div className="order-panel-state error" role="alert">
            <strong>Sipariş detayına şu anda ulaşılamıyor.</strong>
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && detail && (
          <>
            <div className="order-detail-heading">
              <p className="panel-kicker">Sipariş detayı</p>
              <h2 id="order-detail-title">Sipariş #{detail.order_id}</h2>
            </div>

            <ul className="order-detail-list">
              {detail.items.map((item) => (
                <li key={item.product_id}>
                  <span className="order-detail-emoji" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <div>
                    <strong>{item.product_name}</strong>
                    <span>
                      {item.quantity} adet × {formatCurrency(item.price)}
                    </span>
                  </div>
                  <strong>{formatCurrency(item.line_total)}</strong>
                </li>
              ))}
            </ul>

            <div className="order-detail-total">
              <span>Sipariş toplamı</span>
              <strong>{formatCurrency(detail.total_amount)}</strong>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export default OrderDetail;
