import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import OrderDetail from "./OrderDetail.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("OrderDetail", () => {
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

  it("shows item prices and runs back and close callbacks", () => {
    const onBack = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root.render(
        <OrderDetail
          detail={{
            order_id: 22,
            total_amount: 79.8,
            items: [
              {
                product_id: 1,
                product_name: "Salkım Domates",
                emoji: "🍅",
                price: 39.9,
                quantity: 2,
                line_total: 79.8
              }
            ]
          }}
          loading={false}
          error={null}
          onBack={onBack}
          onClose={onClose}
        />
      );
    });

    expect(container.textContent).toContain("Salkım Domates");
    expect(container.textContent).toContain("🍅");
    expect(container.textContent).toContain("2 adet");
    expect(container.textContent).toContain("39,90 TL");
    expect(container.textContent).toContain("79,80 TL");
    expect(container.textContent).toContain("Sipariş toplamı");

    const buttons = Array.from(container.querySelectorAll("button"));
    act(() => buttons.find((button) => button.textContent.includes("Geri dön")).click());
    act(() => buttons.find((button) => button.textContent === "Kapat").click());

    expect(onBack).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
