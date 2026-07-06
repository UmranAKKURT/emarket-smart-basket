import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mocks = vi.hoisted(() => ({ logout: vi.fn(), getDashboard: vi.fn() }));
vi.mock("../hooks/useAdminAuth.js", () => ({
  useAdminAuth: () => ({ adminUser: { email: "admin@example.com" }, logout: mocks.logout })
}));
vi.mock("../services/api.js", () => ({ getAnalyticsDashboard: mocks.getDashboard }));

import AdminDashboardPage from "./AdminDashboardPage.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const data = {
  summary: {
    total_orders: 1,
    total_revenue: 10,
    total_units_sold: 1,
    average_order_value: 10,
    unique_customers: 1,
    total_products: 34,
    total_categories: 7,
    last_order_at: "2026-07-05T09:30:00+00:00",
    most_recommended_product: null
  },
  top_products: [], category_sales: [], daily_sales: [], strongest_rules: []
};

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows admin email and dashboard data", async () => {
    mocks.getDashboard.mockResolvedValue(data);
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>));
    expect(container.textContent).toContain("admin@example.com");
    expect(container.textContent).toContain("Toplam Sipariş");
    act(() => root.unmount());
  });

  it("logs out and navigates to login", async () => {
    mocks.getDashboard.mockResolvedValue(data);
    mocks.logout.mockResolvedValue();
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes><Route path="/admin" element={<AdminDashboardPage />} /><Route path="/admin/login" element={<span>Login</span>} /></Routes>
      </MemoryRouter>
    ));
    await act(async () => Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Çıkış Yap").click());
    expect(mocks.logout).toHaveBeenCalled();
    expect(container.textContent).toContain("Login");
    act(() => root.unmount());
  });

  it("redirects to login when analytics returns 401", async () => {
    mocks.getDashboard.mockRejectedValue(Object.assign(new Error("Oturum gerekli"), { status: 401 }));
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes><Route path="/admin" element={<AdminDashboardPage />} /><Route path="/admin/login" element={<span>Login</span>} /></Routes>
      </MemoryRouter>
    ));
    expect(container.textContent).toContain("Login");
    act(() => root.unmount());
  });
});
