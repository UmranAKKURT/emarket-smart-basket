import { formatCurrency } from "../utils/currency.js";
import { formatDateTime } from "../utils/date.js";
import MetricCard from "./MetricCard.jsx";

function DashboardOverviewCards({ summary, topProducts = [] }) {
  const topSellingProduct = topProducts[0];
  const mostRecommendedProduct = summary.most_recommended_product;
  const comparisonFallback = "Önceki dönem karşılaştırma verisi yok";

  return (
    <div className="metrics-grid" aria-label="Yönetim özeti">
      <MetricCard
        icon="receipt"
        title="Toplam Sipariş"
        value={summary.total_orders}
        subtitle="Tüm zamanlar"
        trend={comparisonFallback}
        tone="primary"
      />
      <MetricCard
        icon="banknote"
        title="Toplam Ciro"
        value={formatCurrency(summary.total_revenue)}
        subtitle="Tüm zamanlar"
        trend={comparisonFallback}
        tone="highlight"
      />
      <MetricCard
        icon="basket"
        title="Ortalama Sepet Tutarı"
        value={formatCurrency(summary.average_order_value)}
        subtitle="Tüm siparişler üzerinden"
        trend={comparisonFallback}
      />
      <MetricCard
        icon="package"
        title="Toplam Satılan Ürün"
        value={summary.total_units_sold}
        subtitle="Tüm zamanlar"
      />
      <MetricCard
        icon="link"
        title="Toplam Birliktelik Kuralı"
        value={summary.total_association_rules}
        subtitle="Geçmiş dahil tüm kayıtlar"
      />
      <MetricCard
        icon="check"
        title="Aktif Rule Sayısı"
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
        subtitle={mostRecommendedProduct ? `${mostRecommendedProduct.recommendation_count} kuralda öneriliyor` : undefined}
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
