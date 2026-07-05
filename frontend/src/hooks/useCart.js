import { useCallback, useEffect, useMemo, useState } from "react";

import {
  clearStoredCart,
  loadCart,
  saveCart
} from "../utils/storage.js";

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

  const cartItemCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart]
  );

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (total, item) => total + Number(item.price) * item.quantity,
        0
      ),
    [cart]
  );

  const basketProductIds = useMemo(
    () => Array.from(new Set(cart.map((item) => item.id))),
    [cart]
  );

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
