import { getUniqueValues } from "./array.js";

export function getUniqueProductIds(items) {
  return getUniqueValues(items.map((item) => item.id));
}

export function getCartItemCount(cart) {
  return cart.reduce((total, item) => total + item.quantity, 0);
}

export function getCartTotal(cart) {
  return cart.reduce(
    (total, item) => total + Number(item.price) * item.quantity,
    0
  );
}

export function toOrderItems(cart) {
  return cart.map((item) => ({
    product_id: item.id,
    quantity: item.quantity
  }));
}
