const CART_STORAGE_KEY = "emarket_smart_basket_cart";

import { clearStoredCart, loadCart, saveCart } from "./storage.js";

describe("cart storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns an empty list when no cart is stored", () => {
    expect(loadCart()).toEqual([]);
  });

  it("loads a valid cart list", () => {
    const cart = [{ id: 1, name: "Elma", price: 12, quantity: 2 }];
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));

    expect(loadCart()).toEqual(cart);
  });

  it("removes invalid JSON without throwing", () => {
    localStorage.setItem(CART_STORAGE_KEY, "{invalid-json");

    expect(loadCart()).toEqual([]);
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });

  it("removes parsed values that are not lists", () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ id: 1 }));

    expect(loadCart()).toEqual([]);
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });

  it("saves and clears the cart with the expected key", () => {
    const cart = [{ id: 2, name: "Süt", price: 30, quantity: 1 }];

    saveCart(cart);
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY))).toEqual(cart);

    clearStoredCart();
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });
});
