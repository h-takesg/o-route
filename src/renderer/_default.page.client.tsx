export { render }
export const clientRouting = true
export const hydrationCanBeAborted = true

import { Root, createRoot, hydrateRoot } from 'react-dom/client'
import { PageShell } from './PageShell'
import type { PageContextClient } from './types'

let root: Root;
async function render(pageContext: PageContextClient) {  
  const { Page, pageProps } = pageContext;

  const page = (
    <PageShell pageContext={pageContext}>
      <Page {...pageProps} />
    </PageShell>
  );

  const container = document.getElementById("root");

  if (container === null) return;

  if (container?.innerHTML === "" || !pageContext.isHydration) {
    if (!root) {
      root = createRoot(container);
    }
    root.render(page);
  } else {
    root = hydrateRoot(container, page);
  }
}
