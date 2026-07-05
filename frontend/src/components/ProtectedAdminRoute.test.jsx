import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const authMock = vi.hoisted(() => ({ value: null }));
vi.mock("../hooks/useAdminAuth.js", () => ({ useAdminAuth: () => authMock.value }));

import ProtectedAdminRoute from "./ProtectedAdminRoute.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderRoute(authValue) {
  authMock.value = authValue;
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin/login" element={<span>Login sayfası</span>} />
          <Route path="/admin" element={<ProtectedAdminRoute><span>Admin içeriği</span></ProtectedAdminRoute>} />
        </Routes>
      </MemoryRouter>
    );
  });
  return { container, root };
}

describe("ProtectedAdminRoute", () => {
  it("shows loading while session validation is pending", async () => {
    const view = await renderRoute({
      isAuthenticated: false,
      refreshAdminSession: vi.fn(() => new Promise(() => {}))
    });
    expect(view.container.textContent).toContain("Admin oturumu kontrol ediliyor...");
    act(() => view.root.unmount());
  });

  it("shows authenticated admin content", async () => {
    const view = await renderRoute({ isAuthenticated: true, refreshAdminSession: vi.fn() });
    expect(view.container.textContent).toContain("Admin içeriği");
    act(() => view.root.unmount());
  });

  it("redirects an unauthorized user", async () => {
    const view = await renderRoute({
      isAuthenticated: false,
      refreshAdminSession: vi.fn().mockRejectedValue(Object.assign(new Error(), { status: 401 }))
    });
    expect(view.container.textContent).toContain("Login sayfası");
    expect(view.container.textContent).not.toContain("Admin içeriği");
    act(() => view.root.unmount());
  });

  it("does not show dashboard to a forbidden user", async () => {
    const view = await renderRoute({
      isAuthenticated: false,
      refreshAdminSession: vi.fn().mockRejectedValue(Object.assign(new Error(), { status: 403 }))
    });
    expect(view.container.textContent).toContain("Bu alana erişim yetkiniz yok.");
    expect(view.container.textContent).not.toContain("Admin içeriği");
    act(() => view.root.unmount());
  });
});
