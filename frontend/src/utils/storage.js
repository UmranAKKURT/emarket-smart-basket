const CART_STORAGE_KEY = "emarket_smart_basket_cart";

function getLocalStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadCart() {
  const storage = getLocalStorage();

  if (!storage) {
    return [];
  }

  try {
    const storedCart = storage.getItem(CART_STORAGE_KEY);

    if (storedCart === null) {
      return [];
    }

    const cart = JSON.parse(storedCart);

    if (!Array.isArray(cart)) {
      storage.removeItem(CART_STORAGE_KEY);
      return [];
    }

    return cart;
  } catch {
    try {
      storage.removeItem(CART_STORAGE_KEY);
    } catch {
      // localStorage erişilemiyorsa uygulama sepeti bellek içinde kullanmaya devam eder.
    }

    return [];
  }
}

export function saveCart(cart) {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Depolama kotası veya tarayıcı kısıtı uygulamanın çalışmasını engellememeli.
  }
}

export function clearStoredCart() {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    storage.removeItem(CART_STORAGE_KEY);
  } catch {
    // localStorage erişilemiyorsa state yine de temizlenebilir.
  }
}
