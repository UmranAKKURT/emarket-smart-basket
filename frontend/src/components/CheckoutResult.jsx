import { formatCurrency } from "../utils/currency.js";

function CheckoutResult({ result, error, onDismiss }) {
  if (!result && !error) {
    return null;
  }

  if (error) {
    return (
      <section className="checkout-result error" role="alert">
        <div>
          <p className="panel-kicker">Sipariş oluşturulamadı</p>
          <h2>Lütfen tekrar deneyin</h2>
        </div>
        <p>{error}</p>
        <button type="button" onClick={onDismiss}>
          Kapat
        </button>
      </section>
    );
  }

  const itemCount = result.items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  return (
    <section className="checkout-result success" role="status">
      <div>
        <p className="panel-kicker">Demo sipariş oluşturuldu</p>
        <h2>Siparişiniz Alındı</h2>
      </div>

      <dl>
        <div>
          <dt>Sipariş numarası</dt>
          <dd>#{result.order_id}</dd>
        </div>
        <div>
          <dt>Toplam tutar</dt>
          <dd>{formatCurrency(result.total_amount)}</dd>
        </div>
        <div>
          <dt>Ürün sayısı</dt>
          <dd>{itemCount}</dd>
        </div>
      </dl>

      <button type="button" onClick={onDismiss}>
        Yeni alışverişe devam et
      </button>
    </section>
  );
}

export default CheckoutResult;
