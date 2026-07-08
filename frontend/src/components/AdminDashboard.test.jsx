import { act } from "react";
import { createRoot } from "react-dom/client";

import AdminDashboard from "./AdminDashboard.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const dashboard = {
  summary: {
    total_orders: 22,
    total_revenue: 4520.75,
    total_units_sold: 67,
    average_order_value: 205.49,
    unique_customers: 16,
    total_products: 34,
    total_categories: 7,
    total_association_rules: 14,
    active_rule_count: 9,
    last_order_at: "2026-07-05T09:30:00+00:00",
    most_recommended_product: {
      product_id: 7,
      product_name: "Ezine Peyniri",
      emoji: "🧀",
      recommendation_count: 3
    }
  },
  period_metrics: {
    last_7_day_orders: 8,
    last_30_day_orders: 22,
    daily_average_orders: 0.73,
    daily_average_revenue: 150.69
  },
  top_product_pairs: [
    {
      first_product_id: 1,
      first_product_name: "Salkım Domates",
      first_product_emoji: "🍅",
      second_product_id: 7,
      second_product_name: "Ezine Peyniri",
      second_product_emoji: "🧀",
      order_count: 6,
      combined_quantity: 18,
      support: 0.27
    }
  ],
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
    expect(container.textContent).toContain("Toplam Association Rule");
    expect(container.textContent).toContain("Aktif Rule Sayısı");
    expect(container.textContent).toContain("Toplam Satılan Ürün");
    expect(container.textContent).toContain("Toplam Ürün");
    expect(container.textContent).toContain("Toplam Kategori");
    expect(container.textContent).toContain("En Çok Satan Ürün");
    expect(container.textContent).toContain("En Çok Önerilen Ürün");
    expect(container.textContent).toContain("Ortalama Sepet Tutarı");
    expect(container.textContent).toContain("Son Sipariş Tarihi");
    expect(container.textContent).toContain("Yeni Analytics");
    expect(container.textContent).toContain("Son 7 Gün Sipariş");
    expect(container.textContent).toContain("Son 30 Gün Sipariş");
    expect(container.textContent).toContain("Günlük Ortalama Sipariş");
    expect(container.textContent).toContain("Günlük Ortalama Ciro");
    expect(container.textContent).toContain("En Çok Birlikte Satılan Ürünler");
    expect(container.textContent).toContain("En Çok Satılan Ürünler");
    expect(container.textContent).toContain("Kategori Dağılımı");
    expect(container.textContent).toContain("Günlük Sipariş Sayısı");
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
