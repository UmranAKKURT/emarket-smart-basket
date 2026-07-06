function MetricCard({ title, value, icon, subtitle, tone = "default" }) {
  return (
    <article className={`metric-card metric-card-${tone}`}>
      {icon && (
        <span className="metric-card-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </article>
  );
}

export default MetricCard;
