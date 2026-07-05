import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";

import StrongRulesTable from "./StrongRulesTable.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("StrongRulesTable", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it("formats product names and rule metrics", () => {
    act(() => {
      root.render(
        <StrongRulesTable
          rules={[
            {
              rule_id: 1,
              antecedent_name: "Salkım Domates",
              antecedent_emoji: "🍅",
              consequent_name: "Ezine Peyniri",
              consequent_emoji: "🧀",
              confidence: 0.75,
              lift: 1.234,
              support: 0.2,
              context_message: "Birlikte sık tercih ediliyor."
            }
          ]}
        />
      );
    });

    expect(container.textContent).toContain("Salkım Domates");
    expect(container.textContent).toContain("Ezine Peyniri");
    expect(container.textContent).toContain("%75.0");
    expect(container.textContent).toContain("1.23");
    expect(container.textContent).toContain("%20.0");
  });

  it("shows an empty data message", () => {
    act(() => root.render(<StrongRulesTable rules={[]} />));

    expect(container.textContent).toContain(
      "Henüz güçlü bir association rule bulunmuyor."
    );
  });
});
