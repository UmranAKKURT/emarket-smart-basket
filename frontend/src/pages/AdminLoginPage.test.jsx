import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const authMock = vi.hoisted(() => ({ value: null }));
vi.mock("../hooks/useAdminAuth.js", () => ({ useAdminAuth: () => authMock.value }));

import AdminLoginPage from "./AdminLoginPage.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("AdminLoginPage", () => {
  it("submits hidden password and navigates on success", async () => {
    const login = vi.fn().mockResolvedValue({});
    authMock.value = { login, isAuthLoading: false, isAuthenticated: false, authError: null };
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/admin/login"]}>
          <Routes>
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/admin" element={<span>Dashboard</span>} />
          </Routes>
        </MemoryRouter>
      );
    });
    const inputs = container.querySelectorAll("input");
    expect(inputs[0].type).toBe("email");
    expect(inputs[1].type).toBe("password");
    await act(async () => {
      inputs[0].value = "admin@example.com";
      inputs[0].dispatchEvent(new Event("input", { bubbles: true }));
      inputs[1].value = "SecretPass!2026";
      inputs[1].dispatchEvent(new Event("input", { bubbles: true }));
      container.querySelector("form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(login).toHaveBeenCalled();
    expect(container.textContent).toContain("Dashboard");
    act(() => root.unmount());
  });

  it("shows error and disables while loading", async () => {
    authMock.value = { login: vi.fn(), isAuthLoading: true, isAuthenticated: false, authError: "E-posta veya parola hatalı." };
    const container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => root.render(<MemoryRouter><AdminLoginPage /></MemoryRouter>));
    expect(container.textContent).toContain("E-posta veya parola hatalı.");
    expect(container.querySelector('button[type="submit"]').disabled).toBe(true);
    act(() => root.unmount());
  });
});
