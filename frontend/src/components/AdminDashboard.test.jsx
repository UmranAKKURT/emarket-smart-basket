import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import AdminDashboard from "./AdminDashboard.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const dashboard = {
  summary: {
    total_orders: 22,
    total_revenue: 4520.75,
    total_units_sold: 67,
    average_order_value: 205.49,
    unique_customers: 16
  },
  top_products: [
    {
      product_id: 1,
      product_name: "Salkım Domates",
      emoji: "🍅",
      category: "Meyve & Sebze",
      total_quantity: 12,
      total_revenue: 478.8,
      order_count: 8
    }
  ],
  category_sales: [
    {
      category: "Meyve & Sebze",
      total_quantity: 12,
      total_revenue: 478.8,
      order_count: 8,
      revenue_share: 1
    }
  ],
  daily_sales: [
    {
      date: "2026-07-05",
      order_count: 2,
      total_quantity: 5,
      total_revenue: 329.5
    }
  ],
  strongest_rules: [
    {
      rule_id: 1,
      antecedent_name: "Salkım Domates",
      antecedent_emoji: "🍅",
      consequent_name: "Ezine Peyniri",
      consequent_emoji: "🧀",
      confidence: 0.75,
      lift: 1.2,
      support: 0.25,
      context_message: "Birlikte tercih ediliyor."
    }
  ]
};

describe("AdminDashboard", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(props = {}) {
    act(() => {
      root.render(
        <AdminDashboard
          dashboard={null}
          loading={false}
          error={null}
          days={30}
          onDaysChange={() => {}}
          onRetry={() => {}}
          onClose={() => {}}
          {...props}
        />
      );
    });
  }

  it("shows the loading message", () => {
    render({ loading: true });
    expect(container.textContent).toContain("Analitik veriler hazırlanıyor...");
  });

  it("shows an error and runs retry", () => {
    const onRetry = vi.fn();
    render({ error: "Backend kapalı.", onRetry });

    expect(container.textContent).toContain(
      "Yönetim verilerine şu anda ulaşılamıyor."
    );
    act(() => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Tekrar Dene")
        .click();
    });
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows every analytics section and runs close", () => {
    const onClose = vi.fn();
    render({ dashboard, onClose });

    expect(container.textContent).toContain("Toplam Sipariş");
    expect(container.textContent).toContain("Toplam Ciro");
    expect(container.textContent).toContain("En Çok Satılan Ürünler");
    expect(container.textContent).toContain("Kategori Satış Dağılımı");
    expect(container.textContent).toContain("Günlük Satış Trendi");
    expect(container.textContent).toContain(
      "En Güçlü Association Rule Sonuçları"
    );

    act(() => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Kapat")
        .click();
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("requests fresh data when the period changes", () => {
    const onDaysChange = vi.fn();
    render({ dashboard, onDaysChange });
    const select = container.querySelector("select");

    act(() => {
      select.value = "90";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onDaysChange).toHaveBeenCalledWith(90);
  });
});
