import { useEffect, useMemo, useRef, useState } from "react";

import CartPanel from "./components/CartPanel.jsx";
import CategoryFilter from "./components/CategoryFilter.jsx";
import CheckoutResult from "./components/CheckoutResult.jsx";
import Header from "./components/Header.jsx";
import OrderDetail from "./components/OrderDetail.jsx";
import OrderHistory from "./components/OrderHistory.jsx";
import ProductGrid from "./components/ProductGrid.jsx";
import RecommendationBox from "./components/RecommendationBox.jsx";
import { useCart } from "./hooks/useCart.js";
import { useRecommendations } from "./hooks/useRecommendations.js";
import {
  checkHealth,
  createOrder,
  getCategories,
  getOrderDetail,
  getOrderHistory,
  getProducts
} from "./services/api.js";

const ALL_CATEGORIES = "Tümü";
const DEMO_USER_ID = 1001;

function normalizeText(value) {
  return value.toLocaleLowerCase("tr-TR").trim();
}

function App() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [checkoutResult, setCheckoutResult] = useState(null);
  const [isOrderHistoryOpen, setIsOrderHistoryOpen] = useState(false);
  const [orderHistory, setOrderHistory] = useState(null);
  const [isOrderHistoryLoading, setIsOrderHistoryLoading] = useState(false);
  const [orderHistoryError, setOrderHistoryError] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderDetailLoading, setIsOrderDetailLoading] = useState(false);
  const [orderDetailError, setOrderDetailError] = useState(null);
  const checkoutInFlightRef = useRef(false);

  const {
    cart,
    addToCart,
    removeFromCart,
    increaseQuantity,
    decreaseQuantity,
    clearCart,
    cartItemCount,
    cartTotal
  } = useCart();

  const {
    recommendation,
    loading: recommendationLoading,
    error: recommendationError
  } = useRecommendations(cart, 3);

  useEffect(() => {
    let isActive = true;

    async function loadInitialData() {
      setLoading(true);
      setError(null);

      try {
        await checkHealth();

        const [productData, categoryData] = await Promise.all([
          getProducts(),
          getCategories()
        ]);

        if (!isActive) {
          return;
        }

        setProducts(productData);
        setCategories(categoryData.categories ?? []);
      } catch (err) {
        if (!isActive) {
          return;
        }

        console.error("Katalog yüklenemedi:", err);
        setError(
          err.message ||
            "Backend çalışmıyor olabilir. Lütfen FastAPI servisini kontrol edin."
        );
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      isActive = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedSearchTerm = normalizeText(searchTerm);

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === ALL_CATEGORIES ||
        product.category === selectedCategory;
      const matchesSearch =
        normalizedSearchTerm === "" ||
        normalizeText(product.name).includes(normalizedSearchTerm);

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  const recommendedProduct = useMemo(() => {
    if (!recommendation) {
      return null;
    }

    return (
      products.find(
        (product) => product.id === recommendation.recommended_product_id
      ) ?? null
    );
  }, [products, recommendation]);

  const recommendedProductInCart = useMemo(() => {
    if (!recommendation) {
      return false;
    }

    return cart.some(
      (item) => item.id === recommendation.recommended_product_id
    );
  }, [cart, recommendation]);

  async function handleCheckout() {
    if (cart.length === 0 || checkoutInFlightRef.current) {
      return;
    }

    checkoutInFlightRef.current = true;
    setIsCheckoutLoading(true);
    setCheckoutError(null);
    setCheckoutResult(null);

    try {
      const result = await createOrder({
        user_id: DEMO_USER_ID,
        items: cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity
        }))
      });

      setCheckoutResult(result);
      clearCart();
    } catch (checkoutException) {
      setCheckoutError(
        checkoutException.message ||
          "Sipariş oluşturulurken beklenmeyen bir hata oluştu."
      );
    } finally {
      checkoutInFlightRef.current = false;
      setIsCheckoutLoading(false);
    }
  }

  function dismissCheckoutResult() {
    setCheckoutError(null);
    setCheckoutResult(null);
  }

  async function openOrderHistory() {
    setIsOrderHistoryOpen(true);
    setSelectedOrder(null);
    setOrderHistoryError(null);
    setIsOrderHistoryLoading(true);

    try {
      setOrderHistory(await getOrderHistory(DEMO_USER_ID));
    } catch (historyException) {
      setOrderHistoryError(
        historyException.message || "Sipariş geçmişi alınamadı."
      );
    } finally {
      setIsOrderHistoryLoading(false);
    }
  }

  async function viewOrderDetail(orderId) {
    setSelectedOrder(null);
    setOrderDetailError(null);
    setIsOrderDetailLoading(true);

    try {
      setSelectedOrder(await getOrderDetail(orderId, DEMO_USER_ID));
    } catch (detailException) {
      setOrderDetailError(
        detailException.message || "Sipariş detayı alınamadı."
      );
    } finally {
      setIsOrderDetailLoading(false);
    }
  }

  function closeOrderHistory() {
    setIsOrderHistoryOpen(false);
    setSelectedOrder(null);
    setOrderDetailError(null);
  }

  function returnToOrderHistory() {
    setSelectedOrder(null);
    setOrderDetailError(null);
    setIsOrderDetailLoading(false);
  }

  return (
    <div className="app-shell">
      <Header
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        cartItemCount={cartItemCount}
        onOpenOrders={openOrderHistory}
      />

      <main className="layout">
        <section className="catalog-section">
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {error && (
            <div className="alert" role="alert">
              <strong>Katalog yüklenemedi.</strong>
              <span>{error}</span>
            </div>
          )}

          <ProductGrid
            products={filteredProducts}
            loading={loading}
            onAddToCart={addToCart}
          />
        </section>

        <aside className="basket-column">
          <CartPanel
            cart={cart}
            total={cartTotal}
            onIncreaseQuantity={increaseQuantity}
            onDecreaseQuantity={decreaseQuantity}
            onRemoveFromCart={removeFromCart}
            onClearCart={clearCart}
            onCheckout={handleCheckout}
            isCheckoutLoading={isCheckoutLoading}
          />
          <CheckoutResult
            result={checkoutResult}
            error={checkoutError}
            onDismiss={dismissCheckoutResult}
          />
          <RecommendationBox
            recommendation={recommendation}
            recommendedProduct={recommendedProduct}
            loading={recommendationLoading}
            error={recommendationError}
            hasCartItems={cart.length > 0}
            isAlreadyInCart={recommendedProductInCart}
            onAddToCart={addToCart}
          />
        </aside>
      </main>

      {isOrderHistoryOpen &&
        (selectedOrder || isOrderDetailLoading || orderDetailError ? (
          <OrderDetail
            detail={selectedOrder}
            loading={isOrderDetailLoading}
            error={orderDetailError}
            onBack={returnToOrderHistory}
            onClose={closeOrderHistory}
          />
        ) : (
          <OrderHistory
            history={orderHistory}
            loading={isOrderHistoryLoading}
            error={orderHistoryError}
            onViewDetail={viewOrderDetail}
            onClose={closeOrderHistory}
          />
        ))}

    </div>
  );
}

export default App;
