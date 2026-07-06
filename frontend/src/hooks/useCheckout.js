import { useCallback, useRef, useState } from "react";

import { createOrder } from "../services/api.js";
import { toOrderItems } from "../utils/cart.js";

export function useCheckout(cart, clearCart, userId) {
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const checkoutInFlightRef = useRef(false);

  const checkout = useCallback(async () => {
    if (cart.length === 0 || checkoutInFlightRef.current) {
      return;
    }

    // Ref, aynı render döngüsünde oluşabilecek çift submit'i de engeller.
    checkoutInFlightRef.current = true;
    setIsCheckoutLoading(true);
    setCheckoutError(null);
    setCheckoutResult(null);

    try {
      const result = await createOrder({
        user_id: userId,
        items: toOrderItems(cart)
      });
      setCheckoutResult(result);
      clearCart();
    } catch (exception) {
      setCheckoutError(
        exception.message ||
          "Sipariş oluşturulurken beklenmeyen bir hata oluştu."
      );
    } finally {
      checkoutInFlightRef.current = false;
      setIsCheckoutLoading(false);
    }
  }, [cart, clearCart, userId]);

  const dismissCheckoutResult = useCallback(() => {
    setCheckoutError(null);
    setCheckoutResult(null);
  }, []);

  return {
    checkout,
    isCheckoutLoading,
    checkoutError,
    checkoutResult,
    dismissCheckoutResult
  };
}

