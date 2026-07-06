import { useMemo, useState } from "react";

import { normalizeSearchText } from "../utils/text.js";
import {
  buildRuleExplanation,
  compareRuleStrength,
  formatRulePercent
} from "../utils/ruleMetrics.js";
import EmptyState from "./EmptyState.jsx";

const SORT_LABELS = {
  confidence: "Confidence",
  lift: "Lift",
  support: "Support"
};

const CONFIDENCE_FILTERS = [
  { label: "Tüm confidence değerleri", value: 0 },
  { label: "En az %60", value: 0.6 },
  { label: "En az %70", value: 0.7 },
  { label: "En az %80", value: 0.8 }
];

function StrongRulesTable({ rules }) {
  const [query, setQuery] = useState("");
  const [minimumConfidence, setMinimumConfidence] = useState(0);
  const [sort, setSort] = useState({ key: "confidence", direction: "desc" });

  const strongestRuleId = useMemo(() => {
    if (rules.length === 0) {
      return null;
    }
    return rules.reduce((strongest, rule) =>
      compareRuleStrength(rule, strongest) > 0 ? rule : strongest
    ).rule_id;
  }, [rules]);

  const visibleRules = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    const direction = sort.direction === "desc" ? -1 : 1;

    return rules
      .filter((rule) => {
        const searchableText = normalizeSearchText([
          rule.antecedent_name,
          rule.consequent_name,
          rule.context_message
        ].join(" "));
        return (
          Number(rule.confidence) >= minimumConfidence &&
          searchableText.includes(normalizedQuery)
        );
      })
      .sort((left, right) => {
        const metricDifference = Number(left[sort.key]) - Number(right[sort.key]);
        return metricDifference === 0
          ? Number(left.rule_id) - Number(right.rule_id)
          : metricDifference * direction;
      });
  }, [minimumConfidence, query, rules, sort]);

  function changeSort(key) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc"
        ? "asc"
        : "desc"
    }));
  }

  if (rules.length === 0) {
    return (
      <p className="analytics-empty">
        Henüz güçlü bir association rule bulunmuyor.
      </p>
    );
  }

  return (
    <div className="strong-rules-panel">
      <div className="rule-filters">
        <label>
          <span>Kural ara</span>
          <input
            type="search"
            placeholder="Ürün veya bağlam ara..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Minimum confidence</span>
          <select
            value={minimumConfidence}
            onChange={(event) => setMinimumConfidence(Number(event.target.value))}
          >
            {CONFIDENCE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>{filter.label}</option>
            ))}
          </select>
        </label>
        <span className="rule-result-count">{visibleRules.length} kural gösteriliyor</span>
      </div>

      {visibleRules.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Filtreye uygun kural bulunamadı"
          description="Arama metnini veya minimum confidence değerini değiştirin."
        />
      ) : (
        <div className="strong-rules-wrapper">
          <table className="strong-rules-table">
            <thead>
              <tr>
                <th>Kural ve açıklama</th>
                {Object.entries(SORT_LABELS).map(([key, label]) => (
                  <th
                    key={key}
                    aria-sort={sort.key === key
                      ? (sort.direction === "desc" ? "descending" : "ascending")
                      : "none"}
                  >
                    <button type="button" onClick={() => changeSort(key)}>
                      {label}
                      <span aria-hidden="true">
                        {sort.key === key ? (sort.direction === "desc" ? "↓" : "↑") : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRules.map((rule) => {
                const isStrongest = rule.rule_id === strongestRuleId;
                return (
                  <tr
                    className={isStrongest ? "rule-row-strongest" : undefined}
                    key={rule.rule_id}
                  >
                    <td>
                      <div className="rule-products">
                        <span>{rule.antecedent_emoji}</span>
                        <strong>{rule.antecedent_name}</strong>
                        <span className="rule-arrow">→</span>
                        <span>{rule.consequent_emoji}</span>
                        <strong>{rule.consequent_name}</strong>
                        {isStrongest && <em>En güçlü kural</em>}
                      </div>
                      <p>{buildRuleExplanation({
                        antecedentName: rule.antecedent_name,
                        consequentName: rule.consequent_name,
                        confidence: rule.confidence
                      })}</p>
                      <small>{rule.context_message}</small>
                    </td>
                    <td><strong>{formatRulePercent(rule.confidence, 1)}</strong></td>
                    <td><strong>{Number(rule.lift).toFixed(2)}×</strong></td>
                    <td><strong>{formatRulePercent(rule.support, 1)}</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="rule-metric-help">
        <span><strong>Confidence:</strong> Kaynak ürünü alanların önerilen ürünü de alma oranı.</span>
        <span><strong>Lift:</strong> İlişkinin rastlantıya göre kaç kat güçlü olduğu.</span>
        <span><strong>Support:</strong> Ürün çiftinin tüm siparişlerde görülme oranı.</span>
      </div>
    </div>
  );
}

export default StrongRulesTable;
