import { act } from "react";
import { createRoot } from "react-dom/client";

import StrongRulesTable from "./StrongRulesTable.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const rules = [
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
  },
  {
    rule_id: 2,
    antecedent_name: "Süt",
    antecedent_emoji: "🥛",
    consequent_name: "Ekmek",
    consequent_emoji: "🍞",
    confidence: 0.84,
    lift: 1.1,
    support: 0.12,
    context_message: "Kahvaltı sepetlerinde birlikte görülüyor."
  }
];

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
          rules={[rules[0]]}
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

  it("filters rules by product name and minimum confidence", () => {
    act(() => root.render(<StrongRulesTable rules={rules} />));
    const search = container.querySelector('input[type="search"]');
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    ).set;

    act(() => {
      valueSetter.call(search, "süt");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(container.textContent).toContain("Süt");
    expect(container.textContent).not.toContain("Salkım Domates");
    expect(container.textContent).toContain("1 kural gösteriliyor");

    act(() => {
      valueSetter.call(search, "");
      search.dispatchEvent(new Event("input", { bubbles: true }));
      const select = container.querySelector(".rule-filters select");
      select.value = "0.8";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).toContain("Süt");
    expect(container.textContent).not.toContain("Salkım Domates");
  });

  it("sorts by support and highlights the strongest rule", () => {
    act(() => root.render(<StrongRulesTable rules={rules} />));
    const supportButton = Array.from(container.querySelectorAll("th button"))
      .find((button) => button.textContent.includes("Support"));

    act(() => supportButton.click());

    const rows = container.querySelectorAll("tbody tr");
    expect(rows[0].textContent).toContain("Salkım Domates");
    expect(container.querySelector(".rule-row-strongest").textContent)
      .toContain("Süt");
    expect(container.textContent).toContain("En güçlü kural");
  });
});
