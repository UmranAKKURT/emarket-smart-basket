import { getProducts } from "./api.js";

describe("api URL construction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the /api/v1 base path for product requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "[]"
    });
    vi.stubGlobal("fetch", fetchMock);

    await getProducts({ category: "İçecek" });

    const requestedUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestedUrl.pathname).toBe("/api/v1/products");
    expect(requestedUrl.searchParams.get("category")).toBe("İçecek");
  });
});
