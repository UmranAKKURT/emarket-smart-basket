import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

const apiMocks = vi.hoisted(() => ({
  checkHealth: vi.fn(),
  createOrder: vi.fn(),
  getCategories: vi.fn(),
  getAnalyticsDashboard: vi.fn(),
  getOrderDetail: vi.fn(),
  getOrderHistory: vi.fn(),
  getProducts: vi.fn(),
  getRecommendations: vi.fn()
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
    apiMocks.checkHealth.mockResolvedValue({ status: "healthy" });
    apiMocks.getProducts.mockResolvedValue([product]);
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
});
