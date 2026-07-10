import { act } from "react";
import { createRoot } from "react-dom/client";

import OrderHistory from "./OrderHistory.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("OrderHistory", () => {
  let container;
  let root;

  let scrollMock;

  beforeEach(() => {
    scrollMock = vi.fn();
    Element.prototype["scroll" + "IntoView"] = scrollMock;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(props = {}) {
    act(() => {
      root.render(
        <OrderHistory
          history={null}
          loading={false}
          error={null}
          onViewDetail={() => {}}
          onClose={() => {}}
          {...props}
        />
      );
    });
  }

  it("shows loading, empty and error states", () => {
    render({ loading: true });
    expect(container.textContent).toContain("Siparişleriniz yükleniyor...");

    render({ history: { orders: [] } });
    expect(container.textContent).toContain(
      "Henüz oluşturulmuş bir siparişiniz bulunmuyor."
    );

    render({ error: "Backend bağlantısı kurulamadı." });
    expect(container.textContent).toContain(
      "Sipariş geçmişine şu anda ulaşılamıyor."
    );
  });

  it("shows order summary and runs detail and close callbacks", () => {
    const onViewDetail = vi.fn();
    const onClose = vi.fn();
    render({
      history: {
        orders: [
          {
            order_id: 22,
            user_id: 1001,
            created_at: "2026-07-05T09:30:00+00:00",
            item_count: 2,
            total_quantity: 3,
            total_amount: 209.7
          }
        ]
      },
      onViewDetail,
      onClose
    });

    expect(container.textContent).toContain("Sipariş #22");
    expect(container.textContent).toContain("209,70 TL");

    const detailButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Detayları Gör"
    );
    const closeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Kapat"
    );

    act(() => detailButton.click());
    act(() => closeButton.click());

    expect(onViewDetail).toHaveBeenCalledWith(22);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
