function StrongRulesTable({ rules }) {
  if (rules.length === 0) {
    return (
      <p className="analytics-empty">
        Henüz güçlü bir association rule bulunmuyor.
      </p>
    );
  }

  return (
    <div className="strong-rules-wrapper">
      <table className="strong-rules-table">
        <thead>
          <tr>
            <th>Kural</th>
            <th>Confidence</th>
            <th>Lift</th>
            <th>Support</th>
            <th>Bağlam</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.rule_id}>
              <td>
                <span>{rule.antecedent_emoji}</span> {rule.antecedent_name}
                <strong className="rule-arrow"> → </strong>
                <span>{rule.consequent_emoji}</span> {rule.consequent_name}
              </td>
              <td>%{(rule.confidence * 100).toFixed(1)}</td>
              <td>{rule.lift.toFixed(2)}</td>
              <td>%{(rule.support * 100).toFixed(1)}</td>
              <td>{rule.context_message}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rule-metric-help">
        <span><strong>Confidence:</strong> Bu ürünü alanların önerilen ürünü alma oranı.</span>
        <span><strong>Lift:</strong> İlişkinin rastlantıya göre gücü.</span>
        <span><strong>Support:</strong> Kuralın tüm siparişlerde görülme oranı.</span>
      </div>
    </div>
  );
}

export default StrongRulesTable;
