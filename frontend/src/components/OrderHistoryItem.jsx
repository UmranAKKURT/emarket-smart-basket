import { formatCurrency } from "../utils/currency.js";

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short"
});

function OrderHistoryItem({ order, onViewDetail }) {
  return (
    <li className="order-history-item">
      <div className="order-history-heading">
        <strong>Sipariş #{order.order_id}</strong>
        <time dateTime={order.created_at}>
          {dateFormatter.format(new Date(order.created_at))}
        </time>
      </div>

      <dl className="order-summary-grid">
        <div>
          <dt>Farklı ürün</dt>
          <dd>{order.item_count}</dd>
        </div>
        <div>
          <dt>Toplam adet</dt>
          <dd>{order.total_quantity}</dd>
        </div>
        <div>
          <dt>Toplam</dt>
          <dd>{formatCurrency(order.total_amount)}</dd>
        </div>
      </dl>

      <button type="button" onClick={() => onViewDetail(order.order_id)}>
        Detayları Gör
      </button>
    </li>
  );
}

export default OrderHistoryItem;
