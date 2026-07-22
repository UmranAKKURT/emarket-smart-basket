import { API_BASE_URL } from "../config/api.js";
import { getUniqueValues } from "../utils/array.js";
import { buildApiUrl } from "../utils/apiUrl.js";
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
  {
    topProductLimit = 10,
    ruleLimit = 10,
    days = 30,
    period = "last_30_days",
    startDate,
    endDate
  } = {},
  options = {}
) {
  return request("/admin/analytics/dashboard", {
    ...options,
    credentials: "include",
    params: {
      top_product_limit: topProductLimit,
      rule_limit: ruleLimit,
      days,
      period,
      start_date: startDate,
      end_date: endDate
    }
  });
}

export function getAnalyticsDashboardStreamUrl({
  days = 30,
  period = "last_30_days",
  startDate,
  endDate
} = {}) {
  return buildApiUrl(API_BASE_URL, "/admin/analytics/dashboard/stream", {
    days,
    period,
    start_date: startDate,
    end_date: endDate
  });
}

export function getAssociationRulesPage({
  limit = 5,
  offset = 0,
  search = "",
  sortBy = "confidence",
  sortDirection = "desc",
  includeInactive = true,
  statusFilter = "all",
  minConfidence,
  minLift,
  minSupport,
  createdFrom,
  createdTo,
  updatedFrom,
  updatedTo
} = {}, options = {}) {
  return request("/admin/analytics/rules/page", {
    ...options,
    credentials: "include",
    params: {
      limit,
      offset,
      search,
      sort_by: sortBy,
      sort_direction: sortDirection,
      include_inactive: includeInactive,
      status_filter: statusFilter,
      min_confidence: minConfidence,
      min_lift: minLift,
      min_support: minSupport,
      created_from: createdFrom,
      created_to: createdTo,
      updated_from: updatedFrom,
      updated_to: updatedTo,
      ...options.params
    }
  });
}

export function getAssociationRuleDetail(ruleId, options = {}) {
  return request(`/admin/analytics/rules/detail/${ruleId}`, {
    ...options,
    credentials: "include"
  });
}

export async function exportAssociationRules({
  format = "csv",
  search = "",
  sortBy = "confidence",
  sortDirection = "desc",
  statusFilter = "all",
  minConfidence,
  minLift,
  minSupport,
  createdFrom,
  createdTo,
  updatedFrom,
  updatedTo
} = {}, options = {}) {
  const response = await fetch(buildApiUrl(API_BASE_URL, "/admin/analytics/rules/export", {
    format,
    search,
    sort_by: sortBy,
    sort_direction: sortDirection,
    status_filter: statusFilter,
    min_confidence: minConfidence,
    min_lift: minLift,
    min_support: minSupport,
    created_from: createdFrom,
    created_to: createdTo,
    updated_from: updatedFrom,
    updated_to: updatedTo
  }), {
    credentials: "include",
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error("Association rule export işlemi başarısız oldu.");
  }

  return response.blob();
}

export function rebuildAssociationRules(csrfToken, options = {}) {
  return request("/admin/rules/rebuild", {
    ...options,
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrfToken, ...options.headers }
  });
}

export function getRecommendations(basketProductIds, limit = 5, options = {}) {
  return request("/recommendations", {
    ...options,
    method: "POST",
    body: {
      basket_product_ids: getUniqueValues(basketProductIds),
      limit
    }
  });
}

export function recordRecommendationEvent(eventData, options = {}) {
  return request("/recommendation-events", {
    ...options,
    method: "POST",
    body: eventData
  });
}
