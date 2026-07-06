import { act } from "react";
import { createRoot } from "react-dom/client";

import { ToastProvider } from "./ToastContext.jsx";
import { useToast } from "../hooks/useToast.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function ToastTrigger() {
  const { showToast } = useToast();
  return (
    <button
      type="button"
      onClick={() => showToast({
        type: "success",
        title: "Sepete eklendi",
        message: "Domates sepetinizde."
      })}
    >
      Bildirim göster
    </button>
  );
}

describe("ToastProvider", () => {
  it("shows and dismisses a success notification", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<ToastProvider><ToastTrigger /></ToastProvider>);
    });
    act(() => container.querySelector("button").click());

    expect(container.querySelector(".toast-success").textContent)
      .toContain("Sepete eklendi");

    act(() => container.querySelector('[aria-label="Bildirimi kapat"]').click());
    expect(container.querySelector(".toast")).toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
