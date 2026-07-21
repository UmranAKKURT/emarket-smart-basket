const compactNumberFormatter = new Intl.NumberFormat("tr-TR", {
  maximumFractionDigits: 1
});

export function formatNumber(value, fractionDigits = 1) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(Number(value) || 0);
}

export function formatCompactNumber(value) {
  return compactNumberFormatter.format(Number(value) || 0);
}

export function formatPercentRatio(value, fractionDigits = 1) {
  return `%${formatNumber((Number(value) || 0) * 100, fractionDigits)}`;
}
