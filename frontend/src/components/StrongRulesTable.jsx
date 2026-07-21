import { useEffect, useMemo, useState } from "react";

import { normalizeSearchText } from "../utils/text.js";
import {
  buildRuleExplanation,
  compareRuleStrength,
  formatRulePercent,
  getRuleReliability
} from "../utils/ruleMetrics.js";
import { formatDateTime } from "../utils/date.js";
import AdminIcon from "./AdminIcon.jsx";
import EmptyState from "./EmptyState.jsx";

const SORT_LABELS = {
  confidence: "Confidence",
  lift: "Lift",
  support: "Support",
  updated_at: "Son güncelleme",
  created_at: "Oluşturma",
  calculation_count: "Hesaplanma"
};

const PAGE_SIZE_OPTIONS = [
  { label: "10 göster", value: 10 },
  { label: "20 göster", value: 20 },
  { label: "50 göster", value: 50 },
  { label: "100 göster", value: 100 },
  { label: "Tümünü göster", value: 500 }
];

function getMetricValue(rule, key) {
  if (key === "created_at" || key === "updated_at") {
    return new Date(rule[key] ?? 0).getTime();
  }
  return Number(rule[key]);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function RuleProducts({ rule, strongest }) {
  const reliability = getRuleReliability(rule);

  return (
    <div className="rule-products">
      <span className="analytics-product-emoji" aria-hidden="true">{rule.antecedent_emoji}</span>
      <strong>{rule.antecedent_name}</strong>
      <span className="rule-arrow">→</span>
      <span className="analytics-product-emoji" aria-hidden="true">{rule.consequent_emoji}</span>
      <strong>{rule.consequent_name}</strong>
      {strongest && <em>En güçlü kural</em>}
      <em className={`rule-reliability rule-reliability-${reliability.tone}`}>
        {reliability.label}
      </em>
    </div>
  );
}

function RuleDetailModal({ rule, onClose }) {
  if (!rule) {
    return null;
  }

  const reliability = getRuleReliability(rule);

  return (
    <div className="rule-modal-backdrop" role="presentation" onClick={onClose}>
      <article
        className="rule-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rule-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="rule-modal-header">
          <div>
            <p className="panel-kicker">Kural detayı</p>
            <h3 id="rule-detail-title">
              {rule.antecedent_name} → {rule.consequent_name}
            </h3>
          </div>
          <button type="button" onClick={onClose}>Kapat</button>
        </div>

        <p>{buildRuleExplanation({
          antecedentName: rule.antecedent_name,
          consequentName: rule.consequent_name,
          confidence: rule.confidence
        })}</p>

        <dl className="rule-detail-grid">
          <div><dt>Confidence</dt><dd>{formatRulePercent(rule.confidence, 1)}</dd></div>
          <div><dt>Lift</dt><dd>{Number(rule.lift).toFixed(2)}×</dd></div>
          <div><dt>Support</dt><dd>{formatRulePercent(rule.support, 1)}</dd></div>
          <div><dt>Hesaplanma</dt><dd>{Number(rule.calculation_count ?? 1)} kez</dd></div>
          <div><dt>Durum</dt><dd>{rule.is_active ? "Aktif" : "Pasif"}</dd></div>
          <div><dt>Oluşturma</dt><dd>{formatDateTime(rule.created_at)}</dd></div>
          <div><dt>Güncelleme</dt><dd>{formatDateTime(rule.updated_at)}</dd></div>
        </dl>

        <small>{rule.context_message}</small>
        <p className={`rule-reliability-note rule-reliability-${reliability.tone}`}>
          {reliability.description}
        </p>
      </article>
    </div>
  );
}

function RuleMetricList({ rule }) {
  return (
    <dl className="rule-card-metrics">
      <div><dt>Confidence</dt><dd>{formatRulePercent(rule.confidence, 1)}</dd></div>
      <div><dt>Lift</dt><dd>{Number(rule.lift).toFixed(2)}×</dd></div>
      <div><dt>Support</dt><dd>{formatRulePercent(rule.support, 1)}</dd></div>
      <div><dt>Durum</dt><dd>{rule.is_active ? "Aktif" : "Pasif"}</dd></div>
    </dl>
  );
}

function StrongRulesTable({
  rules,
  loadRulesPage,
  loadRuleDetail,
  exportRules
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "confidence", direction: "desc" });
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [minConfidence, setMinConfidence] = useState("");
  const [minLift, setMinLift] = useState("");
  const [minSupport, setMinSupport] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [remoteRules, setRemoteRules] = useState(rules);
  const [remoteTotal, setRemoteTotal] = useState(rules.length);
  const [isLoadingPage, setIsLoadingPage] = useState(false);
  const [pageError, setPageError] = useState("");
  const [selectedRule, setSelectedRule] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const isRemote = Boolean(loadRulesPage);

  const filterParams = useMemo(() => ({
    search: query,
    sortBy: sort.key,
    sortDirection: sort.direction,
    statusFilter,
    minConfidence: minConfidence === "" ? undefined : Number(minConfidence),
    minLift: minLift === "" ? undefined : Number(minLift),
    minSupport: minSupport === "" ? undefined : Number(minSupport),
    createdFrom,
    createdTo,
    updatedFrom,
    updatedTo
  }), [
    createdFrom,
    createdTo,
    minConfidence,
    minLift,
    minSupport,
    query,
    sort,
    statusFilter,
    updatedFrom,
    updatedTo
  ]);

  useEffect(() => {
    if (!isRemote) {
      return undefined;
    }

    const controller = new AbortController();
    setIsLoadingPage(true);
    setPageError("");

    loadRulesPage({
      limit: pageSize,
      offset: page * pageSize,
      includeInactive: statusFilter !== "active",
      ...filterParams
    }, { signal: controller.signal })
      .then((data) => {
        setRemoteRules(data.rules ?? []);
        setRemoteTotal(Number(data.total ?? 0));
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setPageError(error.message || "Birliktelik kuralı listesi yüklenemedi.");
          setRemoteRules([]);
          setRemoteTotal(0);
        }
      })
      .finally(() => setIsLoadingPage(false));

    return () => controller.abort();
  }, [filterParams, isRemote, loadRulesPage, page, pageSize, statusFilter]);

  useEffect(() => {
    setPage(0);
  }, [filterParams, pageSize]);

  const sourceRules = isRemote ? remoteRules : rules;
  const totalRules = isRemote ? remoteTotal : sourceRules.length;

  const strongestRuleId = useMemo(() => {
    if (sourceRules.length === 0) {
      return null;
    }

    return sourceRules.reduce((strongest, rule) =>
      compareRuleStrength(rule, strongest) > 0 ? rule : strongest
    ).rule_id;
  }, [sourceRules]);

  const visibleRules = useMemo(() => {
    if (isRemote) {
      return sourceRules;
    }

    const normalizedQuery = normalizeSearchText(query);
    const direction = sort.direction === "desc" ? -1 : 1;

    return sourceRules
      .filter((rule) => {
        const searchableText = normalizeSearchText([
          rule.antecedent_name,
          rule.consequent_name,
          rule.context_message
        ].join(" "));
        const matchesStatus = statusFilter === "all" ||
          (statusFilter === "active" && rule.is_active !== false) ||
          (statusFilter === "passive" && rule.is_active === false);
        return (
          searchableText.includes(normalizedQuery) &&
          matchesStatus &&
          Number(rule.confidence) >= Number(minConfidence || 0) &&
          Number(rule.lift) >= Number(minLift || 0) &&
          Number(rule.support) >= Number(minSupport || 0)
        );
      })
      .sort((left, right) => {
        const metricDifference = getMetricValue(left, sort.key) -
          getMetricValue(right, sort.key);
        return metricDifference === 0
          ? Number(left.rule_id) - Number(right.rule_id)
          : metricDifference * direction;
      });
  }, [isRemote, minConfidence, minLift, minSupport, query, sourceRules, sort, statusFilter]);

  function changeSort(key) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc"
        ? "asc"
        : "desc"
    }));
  }

  async function openRuleDetail(rule) {
    if (!loadRuleDetail) {
      setSelectedRule(rule);
      return;
    }

    setSelectedRule(await loadRuleDetail(rule.rule_id));
  }

  async function handleExport(format) {
    if (!exportRules) {
      return;
    }
    setIsExporting(true);
    try {
      const blob = await exportRules({ format, ...filterParams });
      downloadBlob(blob, `association-rules.${format}`);
    } finally {
      setIsExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalRules / pageSize));

  if (!isRemote && rules.length === 0) {
    return (
      <p className="analytics-empty">
        Henüz güçlü bir birliktelik kuralı bulunmuyor.
      </p>
    );
  }

  return (
    <div className="strong-rules-panel">
      <div className="rule-toolbar">
        <div>
          <p className="panel-kicker">Sunucu taraflı sayfalama</p>
          <h3>Kural Geçmişi</h3>
        </div>
        <div className="rule-export-actions">
          <button type="button" onClick={() => handleExport("csv")} disabled={!exportRules || isExporting}>
            <AdminIcon name="download" />
            <span>CSV Dışa Aktar</span>
          </button>
          <button type="button" onClick={() => handleExport("xlsx")} disabled={!exportRules || isExporting}>
            <AdminIcon name="download" />
            <span>Excel Dışa Aktar</span>
          </button>
        </div>
      </div>
      <p className="rule-export-note">
        Dışa aktarma işlemi aktif arama, durum, tarih ve metrik filtrelerine uyan tüm sonuçları kapsar; yalnızca ekranda görünen sayfayla sınırlı değildir.
      </p>

      <div className="rule-filters rule-filters-advanced">
        <label>
          <span>Kural ara</span>
          <input
            type="search"
            placeholder="Ürün veya bağlam ara..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          <span>Durum</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Tüm kurallar</option>
            <option value="active">Sadece aktif</option>
            <option value="passive">Sadece pasif</option>
          </select>
        </label>
        <label>
          <span>Liste boyutu</span>
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Minimum güven</span>
          <input type="number" min="0" max="1" step="0.01" value={minConfidence} onChange={(event) => setMinConfidence(event.target.value)} />
        </label>
        <label>
          <span>Minimum lift</span>
          <input type="number" min="0" step="0.01" value={minLift} onChange={(event) => setMinLift(event.target.value)} />
        </label>
        <label>
          <span>Minimum support</span>
          <input type="number" min="0" max="1" step="0.01" value={minSupport} onChange={(event) => setMinSupport(event.target.value)} />
        </label>
        <label>
          <span>Oluşturma başlangıcı</span>
          <input type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} />
        </label>
        <label>
          <span>Oluşturma bitişi</span>
          <input type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} />
        </label>
        <label>
          <span>Güncelleme başlangıcı</span>
          <input type="date" value={updatedFrom} onChange={(event) => setUpdatedFrom(event.target.value)} />
        </label>
        <label>
          <span>Güncelleme bitişi</span>
          <input type="date" value={updatedTo} onChange={(event) => setUpdatedTo(event.target.value)} />
        </label>
        <span className="rule-result-count">
          {isRemote ? `${totalRules} toplam kural` : `${visibleRules.length} kural gösteriliyor`}
        </span>
      </div>

      {pageError && <p className="analytics-error">{pageError}</p>}

      {isLoadingPage ? (
        <div className="rule-loading" role="status">Birliktelik kuralları yükleniyor...</div>
      ) : visibleRules.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Filtreye uygun kural bulunamadı"
          description="Arama metnini, sıralamayı veya filtreleri değiştirin."
        />
      ) : (
        <>
          <div className="strong-rules-wrapper">
            <table className="strong-rules-table">
              <thead>
                <tr>
                  <th>Kural ve açıklama</th>
                  {Object.entries(SORT_LABELS).map(([key, label]) => (
                    <th
                      key={key}
                      aria-sort={sort.key === key
                        ? (sort.direction === "desc" ? "descending" : "ascending")
                        : "none"}
                    >
                      <button type="button" onClick={() => changeSort(key)}>
                        {label}
                        <span aria-hidden="true">
                          {sort.key === key ? (sort.direction === "desc" ? "↓" : "↑") : "↕"}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th>Durum</th>
                  <th>Detay</th>
                </tr>
              </thead>
              <tbody>
                {visibleRules.map((rule) => {
                  const isStrongest = rule.rule_id === strongestRuleId;
                  return (
                    <tr
                      className={isStrongest ? "rule-row-strongest" : undefined}
                      key={rule.rule_id}
                    >
                      <td>
                        <RuleProducts rule={rule} strongest={isStrongest} />
                        <p className="rule-summary">{buildRuleExplanation({
                          antecedentName: rule.antecedent_name,
                          consequentName: rule.consequent_name,
                          confidence: rule.confidence
                        })}</p>
                        <small>{rule.context_message}</small>
                      </td>
                      <td className="rule-number"><strong>{formatRulePercent(rule.confidence, 1)}</strong></td>
                      <td className="rule-number"><strong>{Number(rule.lift).toFixed(2)}×</strong></td>
                      <td className="rule-number"><strong>{formatRulePercent(rule.support, 1)}</strong></td>
                      <td className="rule-date">{formatDateTime(rule.updated_at)}</td>
                      <td className="rule-date">{formatDateTime(rule.created_at)}</td>
                      <td className="rule-number"><strong>{Number(rule.calculation_count ?? 1)} kez</strong></td>
                      <td>
                        <span className={rule.is_active ? "rule-status active" : "rule-status passive"}>
                          {rule.is_active ? "Aktif" : "Pasif"}
                        </span>
                      </td>
                      <td>
                        <button className="rule-detail-button" type="button" onClick={() => openRuleDetail(rule)}>
                          Detay
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rule-card-list">
            {visibleRules.map((rule) => {
              const isStrongest = rule.rule_id === strongestRuleId;
              return (
                <article className="rule-card" key={rule.rule_id}>
                  <RuleProducts rule={rule} strongest={isStrongest} />
                  <RuleMetricList rule={rule} />
                  <p className="rule-summary">{buildRuleExplanation({
                    antecedentName: rule.antecedent_name,
                    consequentName: rule.consequent_name,
                    confidence: rule.confidence
                  })}</p>
                  <div className="rule-card-footer">
                    <span>Son güncelleme: {formatDateTime(rule.updated_at)}</span>
                    <button className="rule-detail-button" type="button" onClick={() => openRuleDetail(rule)}>
                      Detay
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {isRemote && totalPages > 1 && (
        <div className="rule-pagination" aria-label="Birliktelik kuralı sayfalama">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            disabled={page === 0 || isLoadingPage}
          >
            Önceki
          </button>
          <span>Sayfa {page + 1} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
            disabled={page >= totalPages - 1 || isLoadingPage}
          >
            Sonraki
          </button>
        </div>
      )}

      <div className="rule-metric-help">
        <span><strong>Confidence:</strong> Kaynak ürünü alanların önerilen ürünü de alma oranı.</span>
        <span><strong>Lift:</strong> İlişkinin rastlantıya göre kaç kat güçlü olduğu.</span>
        <span><strong>Support:</strong> Ürün çiftinin tüm siparişlerde görülme oranı.</span>
      </div>

      <RuleDetailModal rule={selectedRule} onClose={() => setSelectedRule(null)} />
    </div>
  );
}

export default StrongRulesTable;
