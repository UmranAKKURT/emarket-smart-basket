import { useEffect, useMemo, useState } from "react";

import CartPanel from "./components/CartPanel.jsx";
import CategoryFilter from "./components/CategoryFilter.jsx";
import Header from "./components/Header.jsx";
import ProductGrid from "./components/ProductGrid.jsx";
import RecommendationBox from "./components/RecommendationBox.jsx";
import { useRecommendations } from "./hooks/useRecommendations.js";
import { checkHealth, getCategories, getProducts } from "./services/api.js";

const ALL_CATEGORIES = "Tümü";

function normalizeText(value) {
  return value.toLocaleLowerCase("tr-TR").trim();
}

function App() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [searchTerm, setSearchTerm] = useState("");
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  function addToCart(product) {
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
  }

  function removeFromCart(productId) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.id !== productId)
    );
  }

  function increaseQuantity(productId) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  }

  function decreaseQuantity(productId) {
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
  }

  function clearCart() {
    setCart([]);
  }

  return (
    <div className="app-shell">
      <Header
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        cartItemCount={cartItemCount}
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
    </div>
  );
}

export default App;
