const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

function buildUrl(path, params = {}) {
  const base = API_BASE_URL.startsWith("http")
    ? API_BASE_URL
    : `${window.location.origin}${API_BASE_URL}`;
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(`${normalizedBase}/${normalizedPath}`);

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
    signal: options.signal,
    credentials: options.credentials
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).filter(Boolean).join(" ")
      : detail || data?.message || "API isteği başarısız oldu.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
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

export function createOrder(orderData, options = {}) {
  return request("/orders", {
    ...options,
    method: "POST",
    body: orderData
  });
}

export function getOrderHistory(userId, limit = 20, offset = 0, options = {}) {
  return request("/orders", {
    ...options,
    params: {
      user_id: userId,
      limit,
      offset
    }
  });
}

export function getOrderDetail(orderId, userId, options = {}) {
  return request(`/orders/${orderId}`, {
    ...options,
    params: {
      user_id: userId
    }
  });
}

export function getAnalyticsDashboard(
  { topProductLimit = 5, ruleLimit = 10, days = 30 } = {},
  options = {}
) {
  return request("/admin/analytics/dashboard", {
    ...options,
    credentials: "include",
    params: {
      top_product_limit: topProductLimit,
      rule_limit: ruleLimit,
      days
    }
  });
}

export function rebuildAssociationRules(csrfToken, options = {}) {
  return request("/admin/rules/rebuild", {
    ...options,
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrfToken, ...options.headers }
  });
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
