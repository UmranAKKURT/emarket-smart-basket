import { act } from "react";
import { createRoot } from "react-dom/client";

import {
  checkHealth,
  createOrder,
  getCategories,
  getOrderDetail,
  getOrderHistory,
  getProducts,
  getRecommendations
} from "../services/api.js";
import { useCatalog } from "./useCatalog.js";
import { useCheckout } from "./useCheckout.js";
import { useOrderHistory } from "./useOrderHistory.js";
import { useRecommendations } from "./useRecommendations.js";

vi.mock("../services/api.js", () => ({
  checkHealth: vi.fn(),
  createOrder: vi.fn(),
  getCategories: vi.fn(),
  getOrderDetail: vi.fn(),
  getOrderHistory: vi.fn(),
  getProducts: vi.fn(),
  getRecommendations: vi.fn()
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function renderHook(useHook) {
  const container = document.createElement("div");
  const root = createRoot(container);
  let current;

  function Probe() {
    current = useHook();
    return null;
  }

  act(() => root.render(<Probe />));
  return {
    get current() {
      return current;
    },
    unmount() {
      act(() => root.unmount());
    }
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("application hooks", () => {
  let hook;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    hook?.unmount();
    hook = null;
  });

  it("loads and filters the catalog", async () => {
    checkHealth.mockResolvedValue({ status: "healthy" });
    getProducts.mockResolvedValue([
      { id: 1, name: "Süt", category: "İçecek" },
      { id: 2, name: "Ekmek", category: "Temel Gıda" }
    ]);
    getCategories.mockResolvedValue({ categories: ["İçecek", "Temel Gıda"] });

    hook = renderHook(() => useCatalog());
    await flushPromises();

    expect(hook.current.loading).toBe(false);
    expect(hook.current.filteredProducts).toHaveLength(2);
    act(() => hook.current.setSearchTerm("sü"));
    expect(hook.current.filteredProducts.map((product) => product.name)).toEqual([
      "Süt"
    ]);
  });

  it("loads recommendations and exposes the strongest item", async () => {
    const recommendation = { recommended_product_id: 9, confidence: 0.84 };
    const basketProductIds = [1];
    getRecommendations.mockResolvedValue({ recommendations: [recommendation] });

    hook = renderHook(() => useRecommendations(basketProductIds, 3));
    await flushPromises();

    expect(getRecommendations).toHaveBeenCalledWith(
      [1],
      3,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(hook.current.recommendation).toEqual(recommendation);
    expect(hook.current.loading).toBe(false);
  });

  it("creates an order and clears the cart after success", async () => {
    const clearCart = vi.fn();
    const cart = [{ id: 4, name: "Muz", price: 25, quantity: 2 }];
    createOrder.mockResolvedValue({ order_id: 42, total_amount: 50 });
    hook = renderHook(() => useCheckout(cart, clearCart, 1));

    await act(async () => hook.current.checkout());

    expect(createOrder).toHaveBeenCalledWith({
      user_id: 1,
      items: [{ product_id: 4, quantity: 2 }]
    });
    expect(clearCart).toHaveBeenCalledOnce();
    expect(hook.current.checkoutResult.order_id).toBe(42);
  });

  it("loads order history and a selected order detail", async () => {
    getOrderHistory.mockResolvedValue({ orders: [{ order_id: 7 }] });
    getOrderDetail.mockResolvedValue({ order_id: 7, items: [] });
    hook = renderHook(() => useOrderHistory(1));

    await act(async () => hook.current.openHistory());
    expect(hook.current.history.orders).toHaveLength(1);
    expect(hook.current.isOpen).toBe(true);

    await act(async () => hook.current.viewOrderDetail(7));
    expect(getOrderDetail).toHaveBeenCalledWith(7, 1);
    expect(hook.current.selectedOrder.order_id).toBe(7);
  });
});
