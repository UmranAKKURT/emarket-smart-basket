function LoadingSpinner({ label = "Yükleniyor", size = "medium" }) {
  return (
    <span className={`loading-spinner loading-spinner-${size}`} role="status">
      <span className="loading-spinner-ring" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export default LoadingSpinner;

