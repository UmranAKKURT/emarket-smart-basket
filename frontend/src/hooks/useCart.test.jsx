import { StrictMode } from "react";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import { useCart } from "./useCart.js";

const CART_STORAGE_KEY = "emarket_smart_basket_cart";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderCartHook({ strict = false } = {}) {
  const container = document.createElement("div");
  const root = createRoot(container);
  let current;

  function Probe() {
    current = useCart();
    return null;
  }

  act(() => {
    root.render(strict ? <StrictMode><Probe /></StrictMode> : <Probe />);
  });

  return {
    get current() {
      return current;
    },
    unmount() {
      act(() => root.unmount());
    }
  };
}

describe("useCart", () => {
  let hook;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    hook?.unmount();
    hook = null;
  });

  it("preserves and loads a stored cart under StrictMode", () => {
    const storedCart = [
      { id: 7, name: "Kahve", price: 80, category: "İçecek", quantity: 2 }
    ];
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(storedCart));

    hook = renderCartHook({ strict: true });

    expect(hook.current.cart).toEqual(storedCart);
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY))).toEqual(storedCart);
  });

  it("increments quantity when the same product is added again", () => {
    const product = {
      id: 3,
      name: "Ekmek",
      price: 15,
      category: "Fırın",
      emoji: "🍞"
    };
    hook = renderCartHook();

    act(() => hook.current.addToCart(product));
    act(() => hook.current.addToCart(product));

    expect(hook.current.cart).toEqual([{ ...product, quantity: 2 }]);
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY))).toEqual(
      hook.current.cart
    );
  });

  it("removes an item when quantity one is decreased", () => {
    hook = renderCartHook();
    act(() => hook.current.addToCart({ id: 4, name: "Muz", price: 25 }));

    act(() => hook.current.decreaseQuantity(4));

    expect(hook.current.cart).toEqual([]);
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });

  it("returns derived values and clears state and storage", () => {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify([
        { id: 1, name: "Elma", price: 10, quantity: 2 },
        { id: 2, name: "Süt", price: 30, quantity: 1 }
      ])
    );
    hook = renderCartHook();

    expect(hook.current.cartItemCount).toBe(3);
    expect(hook.current.cartTotal).toBe(50);
    expect(hook.current.basketProductIds).toEqual([1, 2]);

    act(() => hook.current.clearCart());

    expect(hook.current.cart).toEqual([]);
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });
});
