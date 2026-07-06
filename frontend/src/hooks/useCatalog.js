import { useCallback, useEffect, useMemo, useState } from "react";

import { ALL_CATEGORIES } from "../config/constants.js";
import { getCategories, getProducts } from "../services/api.js";
import { normalizeSearchText } from "../utils/text.js";

export function useCatalog() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadCatalog = useCallback(async (options = {}) => {
    const { signal } = options;
    setLoading(true);
    setError(null);

    try {
      // Health kontrolünü katalog akışından ayırmak ilk yükleme süresini kısaltır.
      const [productData, categoryData] = await Promise.all([
        getProducts({}, { signal }),
        getCategories({ signal })
      ]);

      if (!signal?.aborted) {
        setProducts(productData);
        setCategories(categoryData.categories ?? []);
      }
    } catch (exception) {
      if (exception.name === "AbortError" || signal?.aborted) {
        return;
      }

      console.error("Katalog yüklenemedi:", exception);
      setError(
        exception.message ||
          "Backend çalışmıyor olabilir. Lütfen FastAPI servisini kontrol edin."
      );
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadCatalog({ signal: controller.signal });
    return () => {
      // Geç tamamlanan isteklerin unmount sonrası state yazmasını önler.
      controller.abort();
    };
  }, [loadCatalog]);

  const clearFilters = useCallback(() => {
    setSelectedCategory(ALL_CATEGORIES);
    setSearchTerm("");
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedSearchTerm = normalizeSearchText(searchTerm);

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === ALL_CATEGORIES ||
        product.category === selectedCategory;
      const matchesSearch =
        normalizedSearchTerm === "" ||
        normalizeSearchText(product.name).includes(normalizedSearchTerm);

      return matchesCategory && matchesSearch;
    });
  }, [products, searchTerm, selectedCategory]);

  const hasActiveFilters = useMemo(
    () =>
      selectedCategory !== ALL_CATEGORIES ||
      normalizeSearchText(searchTerm) !== "",
    [searchTerm, selectedCategory]
  );

  return {
    products,
    categories,
    selectedCategory,
    setSelectedCategory,
    searchTerm,
    setSearchTerm,
    loading,
    error,
    filteredProducts,
    hasActiveFilters,
    clearFilters,
    reloadCatalog: loadCatalog
  };
}
