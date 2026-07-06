import { useCallback, useEffect, useMemo, useState } from "react";

import {
  clearStoredCart,
  loadCart,
  saveCart
} from "../utils/storage.js";
import {
  getCartItemCount,
  getCartTotal,
  getUniqueProductIds
} from "../utils/cart.js";

export function useCart() {
  const [cart, setCart] = useState(() => loadCart());

  useEffect(() => {
    if (cart.length === 0) {
      clearStoredCart();
      return;
    }

    saveCart(cart);
  }, [cart]);

  const addToCart = useCallback((product) => {
    if (!product) {
      return;
    }

    setCart((currentCart) => {
      const existingItem = currentCart.find((item) => item.id === product.id);

      if (existingItem) {
        return currentCart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...currentCart,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          category: product.category,
          emoji: product.emoji,
          quantity: 1
        }
      ];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== productId)
    );
  }, []);

  const increaseQuantity = useCallback((productId) => {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  }, []);

  const decreaseQuantity = useCallback((productId) => {
    setCart((currentCart) =>
      currentCart.flatMap((item) => {
        if (item.id !== productId) {
          return [item];
        }

        if (item.quantity <= 1) {
          return [];
        }

        return [{ ...item, quantity: item.quantity - 1 }];
      })
    );
  }, []);

  const clearCart = useCallback(() => {
    clearStoredCart();
    setCart([]);
  }, []);

  const cartItemCount = useMemo(() => getCartItemCount(cart), [cart]);

  const cartTotal = useMemo(() => getCartTotal(cart), [cart]);

  const basketProductIds = useMemo(() => getUniqueProductIds(cart), [cart]);

  return {
    cart,
    addToCart,
    removeFromCart,
    increaseQuantity,
    decreaseQuantity,
    clearCart,
    cartItemCount,
    cartTotal,
    basketProductIds
  };
}
