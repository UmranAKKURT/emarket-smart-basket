import { adminLogin, adminLogout, getAdminMe } from "./authApi.js";

describe("authApi", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = "emarket_admin_csrf=csrf-value; path=/";
  });

  it("uses credential cookies for login and me", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await adminLogin("admin@example.com", "secret-password");
    await getAdminMe();
    expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
    expect(fetchMock.mock.calls[1][1].credentials).toBe("include");
  });

  it("sends the CSRF cookie on logout", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await adminLogout();
    expect(fetchMock.mock.calls[0][1].headers["X-CSRF-Token"]).toBe("csrf-value");
  });

  it("never writes tokens to browser storage", async () => {
    const localSpy = vi.spyOn(Storage.prototype, "setItem");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    await adminLogin("admin@example.com", "secret-password");
    expect(localSpy).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
