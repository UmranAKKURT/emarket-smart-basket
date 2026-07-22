import { formatCurrency } from "../utils/currency.js";
import { formatDateTime } from "../utils/date.js";
import { formatComparison } from "../utils/analyticsComparison.js";
import MetricCard from "./MetricCard.jsx";

function DashboardOverviewCards({ summary, topProducts = [] }) {
  const topSellingProduct = topProducts[0];
  const mostRecommendedProduct = summary.most_recommended_product;
  const comparisons = summary.comparisons ?? {};
  const comparisonFallback = "Önceki dönem karşılaştırması yok";

  return (
    <div className="metrics-grid" aria-label="Yönetim özeti">
      <MetricCard
        icon="receipt"
        title="Toplam Sipariş"
        value={summary.total_orders}
        subtitle="Seçili dönem"
        trend={comparisons.total_orders ? formatComparison(comparisons.total_orders) : comparisonFallback}
        tone="primary"
      />
      <MetricCard
        icon="banknote"
        title="Toplam Ciro"
        value={formatCurrency(summary.total_revenue)}
        subtitle="Seçili dönem"
        trend={comparisons.total_revenue ? formatComparison(comparisons.total_revenue) : comparisonFallback}
        tone="highlight"
      />
      <MetricCard
        icon="basket"
        title="Ortalama Sepet Tutarı"
        value={formatCurrency(summary.average_order_value)}
        subtitle="Seçili dönem siparişleri üzerinden"
        trend={comparisons.average_order_value ? formatComparison(comparisons.average_order_value) : comparisonFallback}
      />
      <MetricCard
        icon="package"
        title="Toplam Satılan Ürün"
        value={summary.total_units_sold}
        subtitle="Seçili dönem"
        trend={comparisons.total_units_sold ? formatComparison(comparisons.total_units_sold) : comparisonFallback}
      />
      <MetricCard
        icon="link"
        title="Toplam Birliktelik Kuralı"
        value={summary.total_association_rules}
        subtitle="Geçmiş dahil tüm kayıtlar"
      />
      <MetricCard
        icon="check"
        title="Aktif Kural Sayısı"
        value={summary.active_rule_count}
        subtitle="Öneri motorunda kullanılan kurallar"
      />
      <MetricCard
        icon="trend"
        title="En Çok Satan Ürün"
        value={topSellingProduct?.product_name ?? "Veri yok"}
        subtitle={topSellingProduct ? `${topSellingProduct.total_quantity} adet satıldı` : undefined}
        tone="highlight"
      />
      <MetricCard
        icon="spark"
        title="En Çok Önerilen Ürün"
        value={mostRecommendedProduct?.product_name ?? "Veri yok"}
        subtitle={mostRecommendedProduct ? `${mostRecommendedProduct.recommendation_count} aktif kurala göre` : "Tüm aktif kurallara göre"}
        tone="highlight"
      />
      <MetricCard icon="tag" title="Toplam Ürün" value={summary.total_products} />
      <MetricCard icon="grid" title="Toplam Kategori" value={summary.total_categories} />
      <MetricCard
        icon="clock"
        title="Son Sipariş Tarihi"
        value={formatDateTime(summary.last_order_at)}
      />
    </div>
  );
}

export default DashboardOverviewCards;
