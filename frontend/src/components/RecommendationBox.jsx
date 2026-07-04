import { useState } from "react";

import { formatCurrency } from "../utils/currency.js";

function formatPercent(value) {
  return `%${Math.round((Number(value) || 0) * 100)}`;
}

function RecommendationBox({
  recommendation,
  recommendedProduct,
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
        <strong>Öneriler hazırlanıyor...</strong>
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

      <p className="recommendation-message">{recommendation.context_message}</p>

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
        <summary>Neden önerildi?</summary>
        <dl>
          <div>
            <dt>Öneri gücü</dt>
            <dd>{formatPercent(recommendation.confidence)}</dd>
          </div>
          <div>
            <dt>Lift</dt>
            <dd>{Number(recommendation.lift || 0).toFixed(2)}</dd>
          </div>
          <div>
            <dt>Support</dt>
            <dd>{formatPercent(recommendation.support)}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}

export default RecommendationBox;
