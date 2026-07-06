const TOAST_ICONS = {
  success: "✓",
  error: "!",
  info: "i"
};

function ToastViewport({ toasts, onDismiss }) {
  return (
    <aside className="toast-viewport" aria-label="Bildirimler" aria-live="polite">
      {toasts.map((toast) => (
        <div
          className={`toast toast-${toast.type}`}
          key={toast.id}
          role={toast.type === "error" ? "alert" : "status"}
        >
          <span className="toast-icon" aria-hidden="true">
            {TOAST_ICONS[toast.type] ?? TOAST_ICONS.info}
          </span>
          <div className="toast-content">
            <strong>{toast.title}</strong>
            {toast.message && <span>{toast.message}</span>}
          </div>
          <button
            type="button"
            aria-label="Bildirimi kapat"
            onClick={() => onDismiss(toast.id)}
          >
            ×
          </button>
        </div>
      ))}
    </aside>
  );
}

export default ToastViewport;

