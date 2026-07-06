import { act } from "react";
import { createRoot } from "react-dom/client";

import CategoryFilter from "./CategoryFilter.jsx";
import ProductGrid from "./ProductGrid.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function render(element) {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(element));
  return { container, root };
}

describe("catalog components", () => {
  let mounted;

  afterEach(() => {
    if (mounted) act(() => mounted.root.unmount());
    mounted = null;
  });

  it("lists categories and reports the selected category", () => {
    const onSelectCategory = vi.fn();
    mounted = render(
      <CategoryFilter
        categories={["İçecek", "Temel Gıda"]}
        selectedCategory="Tümü"
        onSelectCategory={onSelectCategory}
      />
    );

    const buttons = mounted.container.querySelectorAll("button");
    expect([...buttons].map((button) => button.textContent)).toEqual([
      "Tümü",
      "İçecek",
      "Temel Gıda"
    ]);
    expect(buttons[0].getAttribute("aria-pressed")).toBe("true");

    act(() => buttons[1].click());
    expect(onSelectCategory).toHaveBeenCalledWith("İçecek");
  });

  it("renders products, loading skeletons and the empty state", () => {
    const product = {
      id: 1,
      name: "Süt",
      price: 42,
      category: "İçecek",
      emoji: "🥛"
    };
    const onAddToCart = vi.fn();
    mounted = render(
      <ProductGrid
        products={[product]}
        loading={false}
        onAddToCart={onAddToCart}
      />
    );

    expect(mounted.container.textContent).toContain("Süt");
    const addButton = mounted.container.querySelector("button");
    act(() => addButton.click());
    expect(onAddToCart).toHaveBeenCalledWith(product);

    act(() =>
      mounted.root.render(
        <ProductGrid products={[]} loading onAddToCart={onAddToCart} />
      )
    );
    expect(mounted.container.textContent).toContain("Ürünler yükleniyor");

    act(() =>
      mounted.root.render(
        <ProductGrid products={[]} loading={false} onAddToCart={onAddToCart} />
      )
    );
    expect(mounted.container.textContent).toContain("Ürün bulunamadı");
  });
});
