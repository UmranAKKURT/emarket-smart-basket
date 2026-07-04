const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function buildUrl(path, params = {}) {
  const url = new URL(`${API_BASE_URL}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}

async function request(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error("API adresi bulunamadı. .env dosyasını kontrol edin.");
  }

  const response = await fetch(buildUrl(path, options.params), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.detail || data?.message || "API isteği başarısız oldu.";
    throw new Error(message);
  }

  return data;
}

export function checkHealth(options = {}) {
  return request("/health", options);
}

export function getProducts(filters = {}, options = {}) {
  return request("/products", {
    ...options,
    params: {
      category: filters.category,
      search: filters.search
    }
  });
}

export function getCategories(options = {}) {
  return request("/categories", options);
}

export function getRecommendations(basketProductIds, limit = 3, options = {}) {
  return request("/recommendations", {
    ...options,
    method: "POST",
    body: {
      basket_product_ids: Array.from(new Set(basketProductIds)),
      limit
    }
  });
}
