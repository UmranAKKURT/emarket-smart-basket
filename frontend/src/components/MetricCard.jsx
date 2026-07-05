function MetricCard({ title, value, icon }) {
  return (
    <article className="metric-card">
      {icon && (
        <span className="metric-card-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

export default MetricCard;
