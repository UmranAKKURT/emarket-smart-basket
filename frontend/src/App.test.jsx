import { act } from "react";
import { createRoot } from "react-dom/client";

const apiMocks = vi.hoisted(() => ({
  checkHealth: vi.fn(),
  createOrder: vi.fn(),
  getCategories: vi.fn(),
  getAnalyticsDashboard: vi.fn(),
  getOrderDetail: vi.fn(),
  getOrderHistory: vi.fn(),
  getProducts: vi.fn(),
  getRecommendations: vi.fn(),
  recordRecommendationEvent: vi.fn()
}));

vi.mock("./services/api.js", () => apiMocks);

import App from "./App.jsx";

const CART_STORAGE_KEY = "emarket_smart_basket_cart";
const product = {
  id: 1,
  name: "Salkım Domates",
  price: 39.9,
  category: "Sebze",
  emoji: "🍅",
  quantity: 2
};
const recommendedProduct = {
  id: 2,
  name: "Ezine Peyniri",
  price: 89.5,
  category: "Kahvaltılık",
  emoji: "🧀"
};
const recommendation = {
  source_product_id: 1,
  source_product_name: "Salkım Domates",
  rule_id: 12,
  recommended_product_id: 2,
  recommended_product_name: "Ezine Peyniri",
  recommended_product_price: 89.5,
  recommended_product_category: "Kahvaltılık",
  recommended_product_emoji: "🧀",
  co_occurrence_count: 6,
  support: 0.12,
  confidence: 0.84,
  lift: 2.1,
  score: 1.14,
  context_message: "Domates ve peynir birlikte satın alınır."
};

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function findButton(container, label) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent.includes(label)
  );
}

describe("App checkout flow", () => {
  let container;
  let root;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    apiMocks.checkHealth.mockResolvedValue({ status: "healthy" });
    apiMocks.getProducts.mockResolvedValue([product, recommendedProduct]);
    apiMocks.getCategories.mockResolvedValue({ categories: ["Sebze"] });
    apiMocks.getAnalyticsDashboard.mockResolvedValue(null);
    apiMocks.getOrderHistory.mockResolvedValue({
      user_id: 1001,
      total: 0,
      limit: 20,
      offset: 0,
      orders: []
    });
    apiMocks.getRecommendations.mockResolvedValue({ recommendations: [] });
    apiMocks.recordRecommendationEvent.mockResolvedValue({ recorded: true });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderApp() {
    await act(async () => {
      root.render(<App />);
    });
  }

  it("disables checkout while the cart is empty", async () => {
    await renderApp();

    expect(findButton(container, "Siparişi Tamamla").disabled).toBe(true);
  });

  it("shows loading and clears the cart after a successful order", async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([product]));
    let resolveOrder;
    apiMocks.createOrder.mockReturnValue(
      new Promise((resolve) => {
        resolveOrder = resolve;
      })
    );
    await renderApp();

    const checkoutButton = findButton(container, "Siparişi Tamamla");
    act(() => checkoutButton.click());

    expect(findButton(container, "Sipariş oluşturuluyor...").disabled).toBe(true);
    expect(apiMocks.createOrder).toHaveBeenCalledWith({
      user_id: 1001,
      items: [{ product_id: 1, quantity: 2 }]
    });

    await act(async () => {
      resolveOrder({
        order_id: 16,
        user_id: 1001,
        created_at: "2026-07-05T09:30:00+00:00",
        items: [product],
        total_amount: 79.8,
        rule_rebuild_scheduled: true,
        message: "Siparişiniz başarıyla oluşturuldu."
      });
    });

    expect(container.textContent).toContain("Siparişiniz Alındı");
    expect(container.textContent).toContain("Sepet boş");
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull();
  });

  it("keeps the cart when order creation fails", async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([product]));
    apiMocks.createOrder.mockRejectedValue(new Error("Sipariş kaydedilemedi."));
    await renderApp();

    await act(async () => {
      findButton(container, "Siparişi Tamamla").click();
    });

    expect(container.textContent).toContain("Sipariş kaydedilemedi.");
    expect(container.textContent).toContain("Salkım Domates");
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY))).toEqual([product]);
  });

  it("opens the order history dialog immediately while history is loading", async () => {
    apiMocks.getOrderHistory.mockReturnValue(new Promise(() => {}));
    await renderApp();

    act(() => container.querySelector(".orders-button").click());

    expect(document.body.querySelector(".order-panel-backdrop")).not.toBeNull();
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Siparişleriniz yükleniyor...");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("records each recommendation impression and add-to-cart event once per session key", async () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([product]));
    apiMocks.getRecommendations.mockResolvedValue({
      recommendations: [recommendation]
    });

    await renderApp();
    await act(async () => {});

    expect(apiMocks.recordRecommendationEvent).toHaveBeenCalledTimes(1);
    expect(apiMocks.recordRecommendationEvent.mock.calls[0][0]).toMatchObject({
      event_type: "impression",
      rule_id: 12,
      source_product_id: 1,
      recommended_product_id: 2
    });

    await act(async () => {
      root.render(<App />);
    });

    expect(apiMocks.recordRecommendationEvent).toHaveBeenCalledTimes(1);

    const recommendationButton = container.querySelector(".recommendation-button");
    act(() => {
      recommendationButton.click();
      recommendationButton.click();
    });

    const addToCartEvents = apiMocks.recordRecommendationEvent.mock.calls.filter(
      ([event]) => event.event_type === "add_to_cart"
    );
    expect(addToCartEvents).toHaveLength(1);
  });
});
