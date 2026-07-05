const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function authRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.detail || "Kimlik doğrulama isteği başarısız oldu.");
    error.status = response.status;
    throw error;
  }
  return data;
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
  const prefix = "emarket_admin_csrf=";
  const cookie = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

export function adminLogout() {
  const csrfToken = getCsrfTokenFromCookie();
  return authRequest("/auth/admin/logout", {
    method: "POST",
    headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {}
  });
}
