import { formatPercentRatio } from "./numberFormat.js";

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
    Number(left.support) - Number(right.support)
  );
}

export function getRuleReliability(rule) {
  const support = Number(rule.support) || 0;
  const calculationCount = Number(rule.calculation_count ?? 1);

  if (support < 0.05 || calculationCount < 3) {
    return {
      tone: "warning",
      label: "Sınırlı veri",
      description: "Confidence yüksek olsa bile örneklem küçük olduğu için dikkatli yorumlanmalı."
    };
  }

  return {
    tone: "success",
    label: "Güvenilir örneklem",
    description: "Support ve hesaplanma sayısı bu kuralı daha dengeli yorumlamayı sağlar."
  };
}
