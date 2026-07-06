import { API_BASE_URL } from "../config/api.js";
import { getUniqueValues } from "../utils/array.js";
import { requestJson } from "./httpClient.js";

async function request(path, options = {}) {
  if (!API_BASE_URL) {
    throw new Error("API adresi bulunamadı. .env dosyasını kontrol edin.");
  }

  return requestJson(path, {
    baseUrl: API_BASE_URL,
    method: options.method ?? "GET",
    params: options.params,
    headers: options.headers,
    body: options.body,
    signal: options.signal,
    credentials: options.credentials,
    defaultErrorMessage: "API isteği başarısız oldu.",
    resolveErrorMessage(data) {
      const detail = data?.detail;
      return Array.isArray(detail)
        ? detail.map((item) => item.msg).filter(Boolean).join(" ")
        : detail || data?.message;
    }
  });
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
  { topProductLimit = 10, ruleLimit = 10, days = 30 } = {},
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
      basket_product_ids: getUniqueValues(basketProductIds),
      limit
    }
  });
}
