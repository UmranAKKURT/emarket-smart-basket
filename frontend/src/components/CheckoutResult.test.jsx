import { act } from "react";
import { createRoot } from "react-dom/client";

import CheckoutResult from "./CheckoutResult.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("CheckoutResult", () => {
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

  it("shows order details and runs the continue callback", () => {
    const onDismiss = vi.fn();

    act(() => {
      root.render(
        <CheckoutResult
          result={{
            order_id: 42,
            total_amount: 129.7,
            items: [
              { product_id: 1, quantity: 2 },
              { product_id: 7, quantity: 1 }
            ]
          }}
          error={null}
          onDismiss={onDismiss}
        />
      );
    });

    expect(container.textContent).toContain("Siparişiniz Alındı");
    expect(container.textContent).toContain("#42");
    expect(container.textContent).toContain("129,70 TL");
    expect(container.textContent).toContain("Ürün sayısı3");

    act(() => {
      container.querySelector("button").click();
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("shows a friendly error area", () => {
    act(() => {
      root.render(
        <CheckoutResult
          result={null}
          error="Sipariş servisine ulaşılamadı."
          onDismiss={() => {}}
        />
      );
    });

    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.textContent).toContain("Sipariş servisine ulaşılamadı.");
  });
});
