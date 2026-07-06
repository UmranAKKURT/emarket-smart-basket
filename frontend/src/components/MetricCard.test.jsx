import { act } from "react";
import { createRoot } from "react-dom/client";

import MetricCard from "./MetricCard.jsx";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("MetricCard", () => {
  it("shows title, value and optional icon", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<MetricCard title="Toplam Ciro" value="1.250,00 TL" icon="💰" />);
    });

    expect(container.textContent).toContain("Toplam Ciro");
    expect(container.textContent).toContain("1.250,00 TL");
    expect(container.textContent).toContain("💰");

    act(() => root.unmount());
  });
});
