export function formatRulePercent(value, fractionDigits = 0) {
  return `%${((Number(value) || 0) * 100).toFixed(fractionDigits)}`;
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
