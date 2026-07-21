import AdminIcon from "./AdminIcon.jsx";

function MetricCard({ title, value, icon, subtitle, trend, tone = "default" }) {
  return (
    <article className={`metric-card metric-card-${tone}`}>
      {icon && (
        <span className="metric-card-icon" aria-hidden="true">
          <AdminIcon name={icon} />
        </span>
      )}
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        {subtitle && <small>{subtitle}</small>}
        {trend && <small className="metric-card-trend">{trend}</small>}
      </div>
    </article>
  );
}

export default MetricCard;
