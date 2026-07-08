import { useEffect, useState } from "react";

import { DEFAULT_RECOMMENDATION_LIMIT } from "../config/constants.js";
import { getRecommendations } from "../services/api.js";

export function useRecommendations(
  basketProductIds,
  limit = DEFAULT_RECOMMENDATION_LIMIT
) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (basketProductIds.length === 0) {
      setRecommendations([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    async function loadRecommendations() {
      setLoading(true);
      setError(null);

      try {
        const data = await getRecommendations(basketProductIds, limit, {
          signal: controller.signal
        });

        setRecommendations(data.recommendations ?? []);
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }

        console.error("Öneri alınamadı:", err);
        setRecommendations([]);
        setError(err.message || "Öneriler alınırken bir hata oluştu.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadRecommendations();

    return () => {
      controller.abort();
    };
  }, [basketProductIds, limit]);

  return {
    recommendations,
    recommendation: recommendations[0] ?? null,
    loading,
    error
  };
}
