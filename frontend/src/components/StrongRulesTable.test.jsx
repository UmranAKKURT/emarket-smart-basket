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
    calculation_count: 2,
    is_active: true,
    created_at: "2026-07-01T10:00:00+00:00",
    updated_at: "2026-07-05T10:00:00+00:00",
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
    calculation_count: 4,
    is_active: false,
    created_at: "2026-07-02T10:00:00+00:00",
    updated_at: "2026-07-06T10:00:00+00:00",
    context_message: "Kahvaltı sepetlerinde birlikte görülüyor."
  }
];

describe("StrongRulesTable", () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    URL.createObjectURL = vi.fn(() => "blob:rules");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("formats product names, rule metrics and calculation count", () => {
    act(() => root.render(<StrongRulesTable rules={[rules[0]]} />));

    expect(container.textContent).toContain("Salkım Domates");
    expect(container.textContent).toContain("Ezine Peyniri");
    expect(container.textContent).toContain("%75,0");
    expect(container.textContent).toContain("1.23");
    expect(container.textContent).toContain("%20,0");
    expect(container.textContent).toContain("2 kez");
  });

  it("shows an empty data message", () => {
    act(() => root.render(<StrongRulesTable rules={[]} />));

    expect(container.textContent).toContain(
      "Henüz güçlü bir birliktelik kuralı bulunmuyor."
    );
  });

  it("filters rules by product name and active/passive state", () => {
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
      const statusSelect = container.querySelector(".rule-filters select");
      statusSelect.value = "active";
      statusSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(container.textContent).not.toContain("Süt");
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
  });

  it("uses server-side pagination, detail and export callbacks", async () => {
    const loadRulesPage = vi.fn().mockResolvedValue({
      rules: [rules[0]],
      total: 8
    });
    const loadRuleDetail = vi.fn().mockResolvedValue(rules[0]);
    const exportRules = vi.fn().mockResolvedValue(new Blob(["rule_id"]));

    await act(async () => {
      root.render(
        <StrongRulesTable
          rules={[]}
          loadRulesPage={loadRulesPage}
          loadRuleDetail={loadRuleDetail}
          exportRules={exportRules}
        />
      );
    });

    expect(loadRulesPage).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 0, statusFilter: "all" }),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Detay")
        .click();
    });
    expect(loadRuleDetail).toHaveBeenCalledWith(1);
    expect(container.textContent).toContain("Kural detayı");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("CSV Dışa Aktar"))
        .click();
    });
    expect(exportRules).toHaveBeenCalledWith(
      expect.objectContaining({ format: "csv", statusFilter: "all" })
    );
  });
});
