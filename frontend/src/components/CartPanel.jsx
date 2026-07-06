import CartItem from "./CartItem.jsx";
import EmptyState from "./EmptyState.jsx";
import LoadingSpinner from "./LoadingSpinner.jsx";
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
  const hasCartItems = cart.length > 0;

  return (
    <section className="cart-panel" aria-label="Sepet">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Sepet</p>
          <h2>Akıllı Sepetim</h2>
        </div>
        {hasCartItems && (
          <button
            className="text-button"
            type="button"
            aria-label="Sepetteki tüm ürünleri temizle"
            onClick={onClearCart}
          >
            Temizle
          </button>
        )}
      </div>

      {!hasCartItems ? (
        <div className="cart-empty">
          <EmptyState
            icon="🛒"
            title="Sepet boş"
            description="Beğendiğiniz ürünleri ekleyin; seçimleriniz burada toplansın."
          />
        </div>
      ) : (
        <ul className="cart-list" aria-label="Sepetteki ürünler">
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

      <div className="cart-total" aria-live="polite">
        <span>Toplam</span>
        <strong>{formatCurrency(total)}</strong>
      </div>

      <button
        className="checkout-button"
        type="button"
        disabled={!hasCartItems || isCheckoutLoading}
        aria-busy={isCheckoutLoading ? "true" : "false"}
        onClick={onCheckout}
      >
        {isCheckoutLoading ? (
          <LoadingSpinner label="Sipariş oluşturuluyor..." size="small" />
        ) : (
          "Siparişi Tamamla"
        )}
      </button>
    </section>
  );
}

export default CartPanel;
