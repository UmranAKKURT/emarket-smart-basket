import { formatPercentRatio } from "./numberFormat.js";

export const RULE_RELIABILITY_LIMITS = {
  minSupport: 0.05,
  minCalculationCount: 3
};

export function formatRulePercent(value, fractionDigits = 0) {
  return formatPercentRatio(value, fractionDigits);
}

export function buildRuleExplanation({
  antecedentName,
  consequentName,
  confidence
}) {
  return `${antecedentName} alan kullanıcıların ${formatRulePercent(confidence)}'ü ${consequentName} ürününü de satın aldı.`;
}

export function compareRuleStrength(left, right) {
  return (
    Number(left.confidence) - Number(right.confidence) ||
    Number(left.lift) - Number(right.lift) ||
    Number(left.support) - Number(right.support) ||
    Number(left.calculation_count ?? 1) - Number(right.calculation_count ?? 1)
  );
}

export function isRuleReliable(rule) {
  return (
    Number(rule.support) >= RULE_RELIABILITY_LIMITS.minSupport &&
    Number(rule.calculation_count ?? 1) >= RULE_RELIABILITY_LIMITS.minCalculationCount
  );
}

export function getRuleReliability(rule) {
  if (!isRuleReliable(rule)) {
    return {
      tone: "warning",
      label: "Sınırlı veri",
      description: `Support en az ${formatRulePercent(RULE_RELIABILITY_LIMITS.minSupport, 0)} ve hesaplanma sayısı en az ${RULE_RELIABILITY_LIMITS.minCalculationCount} olmadığında confidence dikkatli yorumlanmalı.`
    };
  }

  return {
    tone: "success",
    label: "Güvenilir örneklem",
    description: "Support ve hesaplanma sayısı bu kuralı daha dengeli yorumlamayı sağlar."
  };
}
