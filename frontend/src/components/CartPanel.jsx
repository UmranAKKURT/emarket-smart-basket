import CartItem from "./CartItem.jsx";
import { formatCurrency } from "../utils/currency.js";

function CartPanel({
  cart,
  total,
  onIncreaseQuantity,
  onDecreaseQuantity,
  onRemoveFromCart,
  onClearCart,
  onCheckout,
  isCheckoutLoading
}) {
  return (
    <section className="cart-panel" aria-label="Sepet">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Sepet</p>
          <h2>Akıllı Sepetim</h2>
        </div>
        {cart.length > 0 && (
          <button className="text-button" type="button" onClick={onClearCart}>
            Temizle
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="cart-empty">
          <strong>Sepet boş</strong>
          <span>Seçimler burada toplanacak.</span>
        </div>
      ) : (
        <ul className="cart-list">
          {cart.map((item) => (
            <CartItem
              key={item.id}
              item={item}
              onIncreaseQuantity={onIncreaseQuantity}
              onDecreaseQuantity={onDecreaseQuantity}
              onRemoveFromCart={onRemoveFromCart}
            />
          ))}
        </ul>
      )}

      <div className="cart-total">
        <span>Toplam</span>
        <strong>{formatCurrency(total)}</strong>
      </div>

      <button
        className="checkout-button"
        type="button"
        disabled={cart.length === 0 || isCheckoutLoading}
        onClick={onCheckout}
      >
        {isCheckoutLoading
          ? "Sipariş oluşturuluyor..."
          : "Siparişi Tamamla"}
      </button>
    </section>
  );
}

export default CartPanel;
