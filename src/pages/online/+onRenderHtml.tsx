export { render as onRenderHtml };

import { escapeInject } from "vike/server";

async function render() {
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
        <div id="root">loading...</div>
      </body>
    </html>`;
}
