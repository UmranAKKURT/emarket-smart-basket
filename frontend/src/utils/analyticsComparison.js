import { formatNumber } from "./numberFormat.js";

export function formatComparison(comparison) {
  if (!comparison) {
    return "Önceki dönem karşılaştırması yok";
  }

  if (comparison.status === "same") {
    return "Değişim yok";
  }

  if (comparison.status === "no_previous") {
    return "Önceki dönemde sipariş yok";
  }

  const arrow = comparison.status === "increase" ? "↑" : "↓";
  return `Önceki döneme göre ${arrow} %${formatNumber(
    comparison.change_percent ?? 0,
    1
  )}`;
}
