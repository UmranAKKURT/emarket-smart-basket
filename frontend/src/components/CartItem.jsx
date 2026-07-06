import { memo } from "react";

import { formatCurrency } from "../utils/currency.js";

function CartItem({
  item,
  onIncreaseQuantity,
  onDecreaseQuantity,
  onRemoveFromCart
}) {
  return (
    <li className="cart-item">
      <div className="cart-item-main">
        <span className="cart-item-emoji" aria-hidden="true">
          {item.emoji}
        </span>
        <div>
          <strong>{item.name}</strong>
          <span>{formatCurrency(item.price)}</span>
        </div>
      </div>

      <div className="quantity-control" aria-label={`${item.name} adedi`}>
        <button
          type="button"
          aria-label={`${item.name} adet azalt`}
          onClick={() => onDecreaseQuantity(item.id)}
        >
          −
        </button>
        <span aria-live="polite">{item.quantity}</span>
        <button
          type="button"
          aria-label={`${item.name} adet artır`}
          onClick={() => onIncreaseQuantity(item.id)}
        >
          +
        </button>
      </div>

      <button
        className="remove-button"
        type="button"
        aria-label={`${item.name} ürününü sepetten kaldır`}
        onClick={() => onRemoveFromCart(item.id)}
      >
        Kaldır
      </button>
    </li>
  );
}

// Sepet güncellenirken referansı değişmeyen satırlar yeniden çizilmez.
export default memo(CartItem);
