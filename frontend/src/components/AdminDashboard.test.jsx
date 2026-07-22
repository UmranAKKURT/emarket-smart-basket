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
    },
    comparisons: {}
  },
  period_metrics: {
    selected_period_orders: 22,
    selected_period_revenue: 4520.75,
    daily_average_orders: 0.73,
    daily_average_revenue: 150.69,
    active_day_count: 5,
    period_day_count: 30,
    comparisons: {
      selected_period_orders: { status: "increase", change_percent: 12.4 },
      selected_period_revenue: { status: "no_previous", change_percent: null },
      daily_average_orders: { status: "same", change_percent: 0 },
      daily_average_revenue: { status: "decrease", change_percent: 3.1 }
    }
  },
  recommendation_impact: {
    impressions: 12,
    add_to_cart: 3,
    purchases: 1,
    recommendation_revenue: 89.5,
    add_to_cart_rate: 0.25,
    purchase_rate: 0.083
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
      calculation_count: 4,
      is_strongest: true,
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
          periodFilter={{ period: "last_30_days", startDate: "", endDate: "" }}
          onPeriodFilterChange={() => {}}
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
    expect(container.textContent).toContain("Toplam Birliktelik Kuralı");
    expect(container.textContent).toContain("Aktif Kural Sayısı");
    expect(container.textContent).toContain("Toplam Satılan Ürün");
    expect(container.textContent).toContain("Toplam Ürün");
    expect(container.textContent).toContain("Toplam Kategori");
    expect(container.textContent).toContain("En Çok Satan Ürün");
    expect(container.textContent).toContain("En Çok Önerilen Ürün");
    expect(container.textContent).toContain("Ortalama Sepet Tutarı");
    expect(container.textContent).toContain("Son Sipariş Tarihi");
    expect(container.textContent).toContain("Dönem Seçimi");
    expect(container.textContent).toContain("Performans Takibi");
    expect(container.textContent).toContain("Öneri kaynaklı ciro");
    expect(container.textContent).toContain("Yeni Analizler");
    expect(container.textContent).not.toContain("Son 7 Gün Sipariş");
    expect(container.textContent).not.toContain("Son 30 Gün Sipariş");
    expect(container.textContent).toContain("Seçili Dönem Sipariş");
    expect(container.textContent).toContain("Seçili Dönem Ciro");
    expect(container.textContent).toContain("Önceki döneme göre ↑ %12,4");
    expect(container.textContent).toContain("Önceki dönemde sipariş yok");
    expect(container.textContent).toContain("Günlük Ortalama Sipariş");
    expect(container.textContent).toContain("Günlük Ortalama Ciro");
    expect(container.textContent).toContain("En Çok Birlikte Satılan Ürünler");
    expect(container.textContent).toContain("En Çok Satılan Ürünler");
    expect(container.textContent).toContain("Kategori Bazında Ciro Dağılımı");
    expect(container.textContent).toContain("Yüzdeler ciro payını gösterir");
    expect(container.textContent).toContain("Günlük Sipariş Sayısı");
    expect(container.textContent).toContain("En Güçlü Birliktelik Kuralları");

    act(() => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Kapat")
        .click();
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("requests fresh data when the global period changes", () => {
    const onPeriodFilterChange = vi.fn();
    render({ dashboard, onPeriodFilterChange });
    const select = container.querySelector(".admin-period-filter select");

    act(() => {
      select.value = "last_7_days";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(onPeriodFilterChange).toHaveBeenCalledWith({ period: "last_7_days" });
  });

  it("explains that all-time period does not use previous-period comparison", () => {
    render({
      dashboard: {
        ...dashboard,
        period_metrics: {
          ...dashboard.period_metrics,
          comparisons: {}
        }
      },
      periodFilter: { period: "all_time", startDate: "", endDate: "" }
    });

    expect(container.textContent).toContain(
      "Tüm zamanlar için dönem karşılaştırması uygulanmaz"
    );
  });
});
