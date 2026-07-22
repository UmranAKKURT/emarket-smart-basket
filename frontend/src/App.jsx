import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import BasketSidebar from "./components/BasketSidebar.jsx";
import CatalogSection from "./components/CatalogSection.jsx";
import Header from "./components/Header.jsx";
import MobileCartFab from "./components/MobileCartFab.jsx";
import OrderPanel from "./components/OrderPanel.jsx";
import {
  DEFAULT_RECOMMENDATION_LIMIT,
  DEMO_USER_ID
} from "./config/constants.js";
import { useCart } from "./hooks/useCart.js";
import { useCatalog } from "./hooks/useCatalog.js";
import { useCheckout } from "./hooks/useCheckout.js";
import { useOrderHistory } from "./hooks/useOrderHistory.js";
import { useRecommendations } from "./hooks/useRecommendations.js";
import { useToast } from "./hooks/useToast.js";
import { recordRecommendationEvent } from "./services/api.js";
import { getSessionId } from "./utils/session.js";

function App() {
  const catalog = useCatalog();
  const cartState = useCart();
  const [recommendationEventKeys, setRecommendationEventKeys] = useState([]);
  const sessionIdRef = useRef(getSessionId());
  const trackedImpressionEventsRef = useRef(new Set());
  const trackedAddToCartEventsRef = useRef(new Set());

  const getRecommendationEventKeys = useCallback(
    () => recommendationEventKeys,
    [recommendationEventKeys]
  );

  const checkout = useCheckout(
    cartState.cart,
    cartState.clearCart,
    DEMO_USER_ID,
    getRecommendationEventKeys
  );
  const orderHistory = useOrderHistory(DEMO_USER_ID);
  const recommendationRefreshKey = useMemo(
    () => cartState.cart
      .map((item) => `${item.id}:${item.quantity}`)
      .join("|"),
    [cartState.cart]
  );
  const recommendationState = useRecommendations(
    cartState.basketProductIds,
    DEFAULT_RECOMMENDATION_LIMIT,
    recommendationRefreshKey
  );
  const { showToast } = useToast();
  const basketRef = useRef(null);

  const buildRecommendationEvent = useCallback((recommendation, eventType) => ({
    event_key: [
      sessionIdRef.current,
      recommendation.rule_id,
      recommendation.source_product_id,
      recommendation.recommended_product_id,
      eventType
    ].join(":"),
    session_id: sessionIdRef.current,
    user_id: DEMO_USER_ID,
    rule_id: recommendation.rule_id,
    source_product_id: recommendation.source_product_id,
    recommended_product_id: recommendation.recommended_product_id,
    event_type: eventType
  }), []);

  const trackRecommendationEvent = useCallback((recommendation, eventType) => {
    if (!recommendation?.rule_id) {
      return null;
    }

    const event = buildRecommendationEvent(recommendation, eventType);
    recordRecommendationEvent(event).catch((exception) => {
      console.warn("Öneri metrik olayı kaydedilemedi:", exception);
    });

    return event.event_key;
  }, [buildRecommendationEvent]);

  const handleRecommendationImpression = useCallback((recommendation) => {
    if (!recommendation?.rule_id) {
      return;
    }

    const eventKey = buildRecommendationEvent(recommendation, "impression").event_key;

    if (trackedImpressionEventsRef.current.has(eventKey)) {
      return;
    }

    trackedImpressionEventsRef.current.add(eventKey);
    trackRecommendationEvent(recommendation, "impression");
  }, [buildRecommendationEvent, trackRecommendationEvent]);

  const handleRecommendationAddToCart = useCallback((recommendation) => {
    const eventKey = buildRecommendationEvent(recommendation, "add_to_cart").event_key;

    if (trackedAddToCartEventsRef.current.has(eventKey)) {
      return;
    }

    trackedAddToCartEventsRef.current.add(eventKey);
    trackRecommendationEvent(recommendation, "add_to_cart");
    setRecommendationEventKeys((currentKeys) => (
      currentKeys.includes(eventKey) ? currentKeys : [...currentKeys, eventKey]
    ));
  }, [buildRecommendationEvent, trackRecommendationEvent]);

  const scrollToBasket = useCallback(() => {
    const basketElement = basketRef.current;

    if (!basketElement) {
      return;
    }

    const isCompactLayout = window.matchMedia?.("(max-width: 980px)").matches ??
      window.innerWidth <= 980;

    if (isCompactLayout) {
      const scrollMarginTop = Number.parseFloat(
        window.getComputedStyle(basketElement).scrollMarginTop
      ) || 0;
      const targetTop = basketElement.getBoundingClientRect().top +
        window.scrollY -
        scrollMarginTop;

      window.scrollTo({
        top: Math.max(targetTop, 0),
        behavior: "smooth"
      });
      return;
    }

    const basketTop = basketElement.getBoundingClientRect().top + window.scrollY;
    const centeredTop = basketTop - Math.max(
      (window.innerHeight - basketElement.offsetHeight) / 2,
      0
    );

    window.scrollTo({
      top: Math.max(centeredTop, 0),
      behavior: "smooth"
    });
  }, []);

  const handleAddToCart = useCallback((product) => {
    cartState.addToCart(product);
    showToast({
      type: "success",
      title: "Sepete eklendi",
      message: `${product.name} sepetinizde.`
    });
  }, [cartState.addToCart, showToast]);

  const handleClearCart = useCallback(() => {
    cartState.clearCart();
    setRecommendationEventKeys([]);
    trackedAddToCartEventsRef.current.clear();
    showToast({
      type: "info",
      title: "Sepet temizlendi",
      message: "Yeni seçimler yapmaya hazırsınız."
    });
  }, [cartState.clearCart, showToast]);

  useEffect(() => {
    if (checkout.checkoutResult) {
      setRecommendationEventKeys([]);
      trackedAddToCartEventsRef.current.clear();
      showToast({
        type: "success",
        title: "Siparişiniz alındı",
        message: `Sipariş #${checkout.checkoutResult.order_id} başarıyla oluşturuldu.`
      });
    }
  }, [checkout.checkoutResult, showToast]);

  useEffect(() => {
    if (checkout.checkoutError) {
      showToast({
        type: "error",
        title: "Sipariş tamamlanamadı",
        message: checkout.checkoutError
      });
    }
  }, [checkout.checkoutError, showToast]);

  useEffect(() => {
    const requestError = catalog.error || orderHistory.historyError ||
      orderHistory.detailError;
    if (requestError) {
      showToast({
        type: "error",
        title: "Bir şeyler yolunda gitmedi",
        message: requestError
      });
    }
  }, [
    catalog.error,
    orderHistory.detailError,
    orderHistory.historyError,
    showToast
  ]);

  return (
    <div className={`app-shell ${
      cartState.cartItemCount > 0 ? "has-mobile-cart-bar" : ""
    }`}>
      <Header
        searchTerm={catalog.searchTerm}
        onSearchChange={catalog.setSearchTerm}
        cartItemCount={cartState.cartItemCount}
        onOpenOrders={orderHistory.openHistory}
      />

      <main className="layout">
        <CatalogSection
          categories={catalog.categories}
          selectedCategory={catalog.selectedCategory}
          onSelectCategory={catalog.setSelectedCategory}
          error={catalog.error}
          products={catalog.filteredProducts}
          loading={catalog.loading}
          hasActiveFilters={catalog.hasActiveFilters}
          onClearFilters={catalog.clearFilters}
          onRetry={catalog.reloadCatalog}
          onAddToCart={handleAddToCart}
        />

        <BasketSidebar
          cart={cartState.cart}
          products={catalog.products}
          cartTotal={cartState.cartTotal}
          recommendation={recommendationState.recommendation}
          recommendations={recommendationState.recommendations}
          recommendationLoading={recommendationState.loading}
          recommendationError={recommendationState.error}
          checkoutResult={checkout.checkoutResult}
          checkoutError={checkout.checkoutError}
          isCheckoutLoading={checkout.isCheckoutLoading}
          onAddToCart={handleAddToCart}
          onIncreaseQuantity={cartState.increaseQuantity}
          onDecreaseQuantity={cartState.decreaseQuantity}
          onRemoveFromCart={cartState.removeFromCart}
          onClearCart={handleClearCart}
          onCheckout={checkout.checkout}
          onDismissCheckout={checkout.dismissCheckoutResult}
          onRecommendationImpression={handleRecommendationImpression}
          onRecommendationAddToCart={handleRecommendationAddToCart}
          panelRef={basketRef}
        />
      </main>

      <MobileCartFab
        cartItemCount={cartState.cartItemCount}
        cartTotal={cartState.cartTotal}
        onClick={scrollToBasket}
      />

      <OrderPanel orderHistory={orderHistory} />
    </div>
  );
}

export default App;
