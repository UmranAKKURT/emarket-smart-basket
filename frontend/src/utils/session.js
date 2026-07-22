const SESSION_STORAGE_KEY = "emarket_smart_basket_session_id";

function createSessionId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getSessionId() {
  try {
    const existingSessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (existingSessionId) {
      return existingSessionId;
    }

    const sessionId = createSessionId();
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    return sessionId;
  } catch {
    return createSessionId();
  }
}
