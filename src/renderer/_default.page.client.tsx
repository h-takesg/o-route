export { render };
export const clientRouting = true;
export const hydrationCanBeAborted = true;

import { Root, createRoot, hydrateRoot } from "react-dom/client";
import { PageShell } from "./PageShell";
import type { PageContextBuiltInClientWithClientRouting } from "vike/types";
import { ElementType } from "react";

let root: Root;
async function render(
  pageContext: PageContextBuiltInClientWithClientRouting<ElementType>,
) {
  const { Page } = pageContext;

  const page = (
    <PageShell>
      <Page />
    </PageShell>
  );

  const container = document.getElementById("root");
  if (container === null) return;

  // 初遷移でcsrページである or client side routingである
  if (container?.innerHTML === "" || !pageContext.isHydration) {
    if (!root) {
      root = createRoot(container);
    }
    root.render(page);
  } else {
    root = hydrateRoot(container, page);
  }
}
