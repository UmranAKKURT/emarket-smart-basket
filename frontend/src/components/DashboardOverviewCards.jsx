import { formatCurrency } from "../utils/currency.js";
import { formatDateTime } from "../utils/date.js";
import MetricCard from "./MetricCard.jsx";

function DashboardOverviewCards({ summary, topProducts = [] }) {
  const topSellingProduct = topProducts[0];
  const mostRecommendedProduct = summary.most_recommended_product;

  return (
    <div className="metrics-grid" aria-label="Yönetim özeti">
      <MetricCard icon="🧾" title="Toplam Sipariş" value={summary.total_orders} tone="primary" />
      <MetricCard icon="💰" title="Toplam Ciro" value={formatCurrency(summary.total_revenue)} tone="highlight" />
      <MetricCard
        icon="🧺"
        title="Ortalama Sepet Tutarı"
        value={formatCurrency(summary.average_order_value)}
      />
      <MetricCard icon="📦" title="Toplam Satılan Ürün" value={summary.total_units_sold} />
      <MetricCard
        icon="🔗"
        title="Toplam Association Rule"
        value={summary.total_association_rules}
        subtitle="Geçmiş dahil tüm kayıtlar"
      />
      <MetricCard
        icon="✅"
        title="Aktif Rule Sayısı"
        value={summary.active_rule_count}
        subtitle="Öneri motorunda kullanılan kurallar"
      />
      <MetricCard
        icon={topSellingProduct?.emoji ?? "🏆"}
        title="En Çok Satan Ürün"
        value={topSellingProduct?.product_name ?? "Veri yok"}
        subtitle={topSellingProduct ? `${topSellingProduct.total_quantity} adet satıldı` : undefined}
        tone="highlight"
      />
      <MetricCard
        icon={mostRecommendedProduct?.emoji ?? "✨"}
        title="En Çok Önerilen Ürün"
        value={mostRecommendedProduct?.product_name ?? "Veri yok"}
        subtitle={mostRecommendedProduct ? `${mostRecommendedProduct.recommendation_count} kuralda öneriliyor` : undefined}
        tone="highlight"
      />
      <MetricCard icon="🏷️" title="Toplam Ürün" value={summary.total_products} />
      <MetricCard icon="🗂️" title="Toplam Kategori" value={summary.total_categories} />
      <MetricCard
        icon="🕒"
        title="Son Sipariş Tarihi"
        value={formatDateTime(summary.last_order_at)}
      />
    </div>
  );
}

export default DashboardOverviewCards;
