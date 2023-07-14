export { render };
// See https://vite-plugin-ssr.com/data-fetching
export const passToClient = ["pageProps"];

import ReactDOMServer from "react-dom/server";
import { PageShell } from "./PageShell";
import { escapeInject, dangerouslySkipEscape } from "vite-plugin-ssr/server";
import type { PageContextBuiltIn } from "vite-plugin-ssr/types";

async function render(pageContext: PageContextBuiltIn) {
  const { Page } = pageContext;
  let pageHtml;
  if (pageContext.Page) {
    pageHtml = ReactDOMServer.renderToString(
      <PageShell pageContext={pageContext}>
        <Page />
      </PageShell>,
    );
  } else {
    pageHtml = "";
  }

  return escapeInject`<!DOCTYPE html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script type="application/ld+json">
          {
            "@context" : "https://schema.org",
            "@type" : "WebSite",
            "name" : "O-Route",
            "url" : "https://o-route.web.app/"
          }
        </script>
        <title>O-Route | オリエンテーリング向けオンラインホワイトボード</title>
        <meta name="description" content="オリエンテーリングの地図読みに使えるオンラインホワイトボード．読み込んだ画像を回転させながらルートを書き込めます．"/>
      </head>
      <body>
        <div id="root">${dangerouslySkipEscape(pageHtml)}</div>
      </body>
    </html>`;
}
