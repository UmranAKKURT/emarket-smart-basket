import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";

import ToastViewport from "../components/ToastViewport.jsx";

const DEFAULT_TOAST_DURATION = 3600;

export const ToastContext = createContext({
  showToast: () => undefined,
  dismissToast: () => undefined
});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef(new Map());

  const dismissToast = useCallback((toastId) => {
    const timer = timersRef.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(toastId);
    }
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const showToast = useCallback((toast) => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    const duration = toast.duration ?? DEFAULT_TOAST_DURATION;

    setToasts((current) => [...current, { id, type: "info", ...toast }]);
    const timer = setTimeout(() => dismissToast(id), duration);
    timersRef.current.set(id, timer);
    return id;
  }, [dismissToast]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [dismissToast, showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

