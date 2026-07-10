import { act } from "react";
import { createRoot } from "react-dom/client";

import MobileCartFab from "./MobileCartFab.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("MobileCartFab", () => {
  it("shows the live cart badge and runs the click handler", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onClick = vi.fn();

    act(() => {
      root.render(<MobileCartFab cartItemCount={4} onClick={onClick} />);
    });

    const button = container.querySelector(".mobile-cart-fab");
    expect(button).not.toBeNull();
    expect(button.getAttribute("aria-label")).toContain("4 ürün");
    expect(container.querySelector(".mobile-cart-fab-badge").textContent).toBe("4");

    act(() => button.click());

    expect(onClick).toHaveBeenCalledOnce();

    act(() => root.unmount());
  });
});
