export { render as onRenderClient };

import { Root, createRoot, hydrateRoot } from "react-dom/client";
import { PageShell } from "./PageShell";
import type { PageContextClient } from "vike/types";

let root: Root;
async function render(
  pageContext: PageContextClient,
) {
  const { Page } = pageContext;

  const page = (
    <PageShell>
      <Page />
    </PageShell>
  );

  const container = document.getElementById("root");
  if (container === null) return;

  const isPlaceholder = container.textContent?.trim() === "loading...";

  // 初遷移でcsrページである or client side routingである or プレースホルダHTML
  if (container.innerHTML === "" || !pageContext.isHydration || isPlaceholder) {
    if (!root) {
      root = createRoot(container);
    }
    root.render(page);
  } else {
    root = hydrateRoot(container, page);
  }
}
