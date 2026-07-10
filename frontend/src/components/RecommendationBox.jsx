import { useState } from "react";

import { formatCurrency } from "../utils/currency.js";
import {
  buildRuleExplanation,
  formatRulePercent
} from "../utils/ruleMetrics.js";
import LoadingSpinner from "./LoadingSpinner.jsx";

function RecommendationBox({
  recommendation,
  recommendations = [],
  recommendedProduct,
  products = [],
  loading,
  error,
  hasCartItems,
  isAlreadyInCart,
  onAddToCart
}) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  if (!hasCartItems) {
    return (
      <section className="recommendation-box muted" aria-label="Ürün önerisi">
        <p className="panel-kicker">Sepetini Tamamla</p>
        <strong>Öneri için sepet bekleniyor.</strong>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="recommendation-box muted" aria-live="polite">
        <p className="panel-kicker">Sepetini Tamamla</p>
        <LoadingSpinner label="Öneriler hazırlanıyor..." size="small" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="recommendation-box error" aria-live="polite">
        <p className="panel-kicker">Öneri alınamadı</p>
        <strong>{error}</strong>
      </section>
    );
  }

  if (!recommendation || isAlreadyInCart) {
    return (
      <section className="recommendation-box muted" aria-live="polite">
        <p className="panel-kicker">Sepetini Tamamla</p>
        <strong>Bu sepet için güçlü öneri bulunamadı.</strong>
      </section>
    );
  }

  const canAddRecommendation = Boolean(recommendedProduct);

  return (
    <section className="recommendation-box" aria-label="Ürün önerisi">
      <p className="panel-kicker">Tarifini Tamamla</p>
      <div className="recommendation-product">
        <span className="recommendation-emoji" aria-hidden="true">
          {recommendation.recommended_product_emoji}
        </span>
        <div>
          <h2>{recommendation.recommended_product_name}</h2>
          <strong>{formatCurrency(recommendation.recommended_product_price)}</strong>
        </div>
      </div>

      <div className="recommendation-reason">
        <span aria-hidden="true">✨</span>
        <div>
          <strong>Neden bu ürün?</strong>
          <p>
            {buildRuleExplanation({
              antecedentName: recommendation.source_product_name,
              consequentName: recommendation.recommended_product_name,
              confidence: recommendation.confidence
            })}
          </p>
        </div>
      </div>

      <dl className="recommendation-metrics" aria-label="Öneri metrikleri">
        <div>
          <dt>Confidence</dt>
          <dd>{formatRulePercent(recommendation.confidence)}</dd>
          <small>Birlikte alma oranı</small>
        </div>
        <div>
          <dt>Lift</dt>
          <dd>{Number(recommendation.lift || 0).toFixed(2)}×</dd>
          <small>Beklenene göre ilişki gücü</small>
        </div>
        <div>
          <dt>Support</dt>
          <dd>{formatRulePercent(recommendation.support)}</dd>
          <small>Tüm siparişlerde görülme</small>
        </div>
      </dl>

      <p className="recommendation-message">{recommendation.context_message}</p>
      <p className="recommendation-message">
        Geçmiş sipariş analizlerine göre {recommendation.source_product_name} ve{" "}
        {recommendation.recommended_product_name} ürünleri{" "}
        {Number(recommendation.co_occurrence_count ?? 0)} farklı siparişte birlikte
        satın alınmıştır. Bu nedenle size {recommendation.recommended_product_name}{" "}
        ürünü önerilmektedir. Toplam öneri skoru:{" "}
        {Number(recommendation.score ?? 0).toFixed(3)}.
      </p>

      {recommendations.length > 1 && (
        <div className="recommendation-list" aria-label="En iyi öneriler">
          <strong>En iyi {Math.min(recommendations.length, 5)} öneri</strong>
          {recommendations.slice(0, 5).map((item, index) => {
            const product = products.find(
              (candidate) => candidate.id === item.recommended_product_id
            );
            return (
              <button
                type="button"
                key={`${item.source_product_id}-${item.recommended_product_id}`}
                disabled={!product}
                onClick={() => product && onAddToCart(product)}
              >
                <span>{index + 1}</span>
                <span>{item.recommended_product_emoji}</span>
                <strong>{item.recommended_product_name}</strong>
                <small>
                  %{(Number(item.confidence) * 100).toFixed(0)} confidence · {Number(item.lift).toFixed(2)}× lift · skor {Number(item.score ?? 0).toFixed(2)}
                </small>
              </button>
            );
          })}
        </div>
      )}

      <button
        className="recommendation-button"
        type="button"
        disabled={!canAddRecommendation}
        onClick={() => onAddToCart(recommendedProduct)}
      >
        {canAddRecommendation ? "Sepete Ekle" : "Ürün bulunamadı"}
      </button>

      <details
        className="recommendation-details"
        open={isDetailsOpen}
        onToggle={(event) => setIsDetailsOpen(event.currentTarget.open)}
      >
        <summary>Metrikler ne anlama geliyor?</summary>
        <dl>
          <div>
            <dt>Confidence</dt>
            <dd>Kaynak ürünü alanların önerilen ürünü de alma oranıdır.</dd>
          </div>
          <div>
            <dt>Lift</dt>
            <dd>İlişkinin rastlantıya göre kaç kat güçlü olduğunu gösterir.</dd>
          </div>
          <div>
            <dt>Support</dt>
            <dd>Bu ürün çiftinin tüm siparişlerde görülme oranıdır.</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}

export default RecommendationBox;
