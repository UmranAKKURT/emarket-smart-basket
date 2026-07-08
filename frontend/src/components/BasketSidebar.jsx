import { useMemo } from "react";

import CartPanel from "./CartPanel.jsx";
import CheckoutResult from "./CheckoutResult.jsx";
import RecommendationBox from "./RecommendationBox.jsx";

function BasketSidebar({
  cart,
  products,
  cartTotal,
  recommendation,
  recommendations = [],
  recommendationLoading,
  recommendationError,
  checkoutResult,
  checkoutError,
  isCheckoutLoading,
  onAddToCart,
  onIncreaseQuantity,
  onDecreaseQuantity,
  onRemoveFromCart,
  onClearCart,
  onCheckout,
  onDismissCheckout,
  panelRef
}) {
  const recommendedProduct = useMemo(() => {
    if (!recommendation) {
      return null;
    }
    return products.find(
      (product) => product.id === recommendation.recommended_product_id
    ) ?? null;
  }, [products, recommendation]);

  const recommendedProductInCart = useMemo(
    () => Boolean(recommendation) && cart.some(
      (item) => item.id === recommendation.recommended_product_id
    ),
    [cart, recommendation]
  );

  return (
    <aside className="basket-column" ref={panelRef}>
      <CartPanel
        cart={cart}
        total={cartTotal}
        onIncreaseQuantity={onIncreaseQuantity}
        onDecreaseQuantity={onDecreaseQuantity}
        onRemoveFromCart={onRemoveFromCart}
        onClearCart={onClearCart}
        onCheckout={onCheckout}
        isCheckoutLoading={isCheckoutLoading}
      />
      <CheckoutResult
        result={checkoutResult}
        error={checkoutError}
        onDismiss={onDismissCheckout}
      />
      <RecommendationBox
        recommendation={recommendation}
        recommendations={recommendations}
        recommendedProduct={recommendedProduct}
        products={products}
        loading={recommendationLoading}
        error={recommendationError}
        hasCartItems={cart.length > 0}
        isAlreadyInCart={recommendedProductInCart}
        onAddToCart={onAddToCart}
      />
    </aside>
  );
}

export default BasketSidebar;
