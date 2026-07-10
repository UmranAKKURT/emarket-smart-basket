import EmptyState from "./EmptyState.jsx";
import LoadingSpinner from "./LoadingSpinner.jsx";
import OrderHistoryItem from "./OrderHistoryItem.jsx";

function OrderHistory({ history, loading, error, onViewDetail, onClose }) {
  const orders = history?.orders ?? [];
  return (
    <div className="order-panel-backdrop" role="presentation">
      <section
        className="order-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-history-title"
        tabIndex={-1}
      >
        <div className="order-panel-header">
          <div>
            <p className="panel-kicker">Demo kullanıcı 1001</p>
            <h2 id="order-history-title">Siparişlerim</h2>
          </div>
          <button className="text-button" type="button" onClick={onClose}>
            Kapat
          </button>
        </div>

        {loading && (
          <div className="order-panel-state">
            <LoadingSpinner label="Siparişleriniz yükleniyor..." />
          </div>
        )}

        {!loading && error && (
          <div className="order-panel-state error" role="alert">
            <strong>Sipariş geçmişine şu anda ulaşılamıyor.</strong>
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="order-panel-state">
            <EmptyState
              icon="📦"
              title="Henüz siparişiniz yok"
              description="Henüz oluşturulmuş bir siparişiniz bulunmuyor. İlk sepetinizi hazırlamaya başlayın."
            />
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <ul className="order-history-list">
            {orders.map((order) => (
              <OrderHistoryItem
                key={order.order_id}
                order={order}
                onViewDetail={onViewDetail}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default OrderHistory;
