import {
  ADMIN_CSRF_COOKIE_NAME,
  API_BASE_URL
} from "../config/api.js";
import { getCookieValue } from "../utils/cookies.js";
import { requestJson } from "./httpClient.js";

async function authRequest(path, options = {}) {
  return requestJson(path, {
    baseUrl: API_BASE_URL,
    method: options.method ?? "GET",
    credentials: "include",
    headers: options.headers,
    body: options.body,
    defaultErrorMessage: "Kimlik doğrulama isteği başarısız oldu.",
    resolveErrorMessage: (data) => data?.detail,
    // Auth endpointleri boş veya geçersiz hata gövdelerinde genel mesaj kullanır.
    ignoreInvalidJson: true
  });
}

export function adminLogin(email, password) {
  return authRequest("/auth/admin/login", {
    method: "POST",
    body: { email, password }
  });
}

export function getAdminMe() {
  return authRequest("/auth/admin/me");
}

export function getCsrfTokenFromCookie() {
  return getCookieValue(ADMIN_CSRF_COOKIE_NAME);
}

export function adminLogout() {
  const csrfToken = getCsrfTokenFromCookie();
  return authRequest("/auth/admin/logout", {
    method: "POST",
    headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {}
  });
}
