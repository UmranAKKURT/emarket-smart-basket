import { act } from "react";
import { createRoot } from "react-dom/client";

import RecommendationBox from "./RecommendationBox.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("RecommendationBox", () => {
  it("explains the recommendation and displays all rule metrics", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const recommendation = {
      source_product_name: "Süt",
      recommended_product_id: 2,
      recommended_product_name: "Ekmek",
      recommended_product_price: 24.9,
      recommended_product_emoji: "🍞",
      confidence: 0.84,
      lift: 1.32,
      support: 0.18,
      context_message: "Kahvaltı sepetlerinde birlikte tercih ediliyor."
    };

    act(() => {
      root.render(
        <RecommendationBox
          recommendation={recommendation}
          recommendedProduct={{ id: 2, name: "Ekmek" }}
          loading={false}
          error={null}
          hasCartItems
          isAlreadyInCart={false}
          onAddToCart={() => {}}
        />
      );
    });

    expect(container.textContent)
      .toContain("Süt alan kullanıcıların %84'ü Ekmek ürününü de satın aldı.");
    expect(container.textContent).toContain("Confidence%84");
    expect(container.textContent).toContain("Lift1.32×");
    expect(container.textContent).toContain("Support%18");

    act(() => root.unmount());
  });
});
