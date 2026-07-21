import { act } from "react";
import { createRoot } from "react-dom/client";

import MobileCartFab from "./MobileCartFab.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("MobileCartFab", () => {
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

  it("does not render while the cart is empty", () => {
    act(() => {
      root.render(<MobileCartFab cartItemCount={0} cartTotal={0} onClick={() => {}} />);
    });

    expect(document.body.querySelector(".mobile-cart-fab")).toBeNull();
  });

  it("shows the live cart count, total amount and runs the click handler", () => {
    const onClick = vi.fn();

    act(() => {
      root.render(<MobileCartFab cartItemCount={4} cartTotal={57.8} onClick={onClick} />);
    });

    const button = document.body.querySelector(".mobile-cart-fab");
    expect(button).not.toBeNull();
    expect(button.getAttribute("aria-label")).toContain("4 ürün");
    expect(button.getAttribute("aria-label")).toContain("57,80 TL");
    expect(document.body.textContent).toContain("Sepete Git");
    expect(document.body.textContent).toContain("4 ürün · 57,80 TL");

    act(() => button.click());

    expect(onClick).toHaveBeenCalledOnce();
  });
});
