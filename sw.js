/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-25ee6505'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "402b66900e731ca748771b6fc5e7a068"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "355071365b7b0dec20f0861622056568"
  }, {
    "url": "pwa-512x512.png",
    "revision": "355071365b7b0dec20f0861622056568"
  }, {
    "url": "pwa-192x192.png",
    "revision": "41a502053af28a0727d9a01020db6d0b"
  }, {
    "url": "index.html",
    "revision": "d216d5b09243c68d3f87963643eec33a"
  }, {
    "url": "icon.svg",
    "revision": "9d2f87dbbe049f8df9d94ffdbc399a40"
  }, {
    "url": "favicon.ico",
    "revision": "8d2eb673884111423c1b858f4e235a98"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "1dd3ed7860b0d46cdeef8bed603d9225"
  }, {
    "url": "404.html",
    "revision": "9613222f124aae2ce555c08192f4c56c"
  }, {
    "url": "img/og-default.webp",
    "revision": "1184733419faa33f431a10e1820509b9"
  }, {
    "url": "img/og-default.jpg",
    "revision": "e55ee3e57d68273228cdf6b48490f067"
  }, {
    "url": "img/products/vermicompost-grade-a.webp",
    "revision": "ab76f9434928cf9a93f7229e2d2af37e"
  }, {
    "url": "img/products/vermi-tea-liquid.webp",
    "revision": "718ee54982610e9f6ed2fae8c1b00348"
  }, {
    "url": "img/products/thermo-compost.webp",
    "revision": "1d701ab8b3268c0ea9db003e5b04c80c"
  }, {
    "url": "img/products/live-worm-starter.webp",
    "revision": "0bf375887eb788cc0df880bf7cd6e4d2"
  }, {
    "url": "img/products/lab-quality-analysis.webp",
    "revision": "f82afd1e714de36da4156ddb3ad540a0"
  }, {
    "url": "img/products/coffee-zeolite-substrate.webp",
    "revision": "7afd9cbc81003d1297ee14d07077673c"
  }, {
    "url": "img/products/agricultural-zeolite.webp",
    "revision": "648013580a5c125615cacf4ccdc615b1"
  }, {
    "url": "assets/vazirmatn-latin-ext-900-normal-DFoB6cWj.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-ext-900-normal-5ssG3_7O.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-ext-800-normal-HbVXW2Kv.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-ext-800-normal-BzH3Tiwu.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-ext-700-normal-DMYLqBto.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-ext-700-normal-BfoXmNMx.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-ext-600-normal-Di8rk35l.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-ext-600-normal-CyxCUfFz.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-ext-500-normal-CgxvvVrG.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-ext-500-normal-4XgegWYb.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-ext-400-normal-DPxMaNjI.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-ext-400-normal-BdGhO0lm.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-900-normal-DUUbkNfs.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-900-normal-BGmAvq1S.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-800-normal-fM8Xz9cI.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-800-normal-e0EQwLmk.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-700-normal-DrB0PBU6.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-700-normal-9BlbvDRV.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-600-normal-D-zF-Oec.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-600-normal-BxJiDPKT.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-500-normal-Bg_BALlD.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-500-normal-6zZzgpg4.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-400-normal-GKyMcI03.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-latin-400-normal-BT_DHTc7.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-arabic-900-normal-DxDkRnCr.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-arabic-900-normal-BVDx3pOU.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-arabic-800-normal-Bwnt96zj.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-arabic-800-normal-BH12s3-y.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-arabic-700-normal-Dge_DOjm.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-arabic-700-normal-B5nPuCFv.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-arabic-600-normal-CWYTfCgi.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-arabic-600-normal-CPKvAnd1.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-arabic-500-normal-Dqq3-xo3.woff",
    "revision": null
  }, {
    "url": "assets/vazirmatn-arabic-500-normal-C_lbnnKa.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-arabic-400-normal-DMZFCm7K.woff2",
    "revision": null
  }, {
    "url": "assets/vazirmatn-arabic-400-normal-C4W5XURk.woff",
    "revision": null
  }, {
    "url": "assets/index-ETlelNX7.js",
    "revision": null
  }, {
    "url": "assets/index-C3fMRU2l.css",
    "revision": null
  }, {
    "url": "assets/aistudio/1_7778a20f.jpg",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "1dd3ed7860b0d46cdeef8bed603d9225"
  }, {
    "url": "favicon.ico",
    "revision": "8d2eb673884111423c1b858f4e235a98"
  }, {
    "url": "icon.svg",
    "revision": "9d2f87dbbe049f8df9d94ffdbc399a40"
  }, {
    "url": "pwa-192x192.png",
    "revision": "41a502053af28a0727d9a01020db6d0b"
  }, {
    "url": "pwa-512x512.png",
    "revision": "355071365b7b0dec20f0861622056568"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "355071365b7b0dec20f0861622056568"
  }, {
    "url": "manifest.webmanifest",
    "revision": "b46b7d8ad716e0148ef41beb285991d8"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html"), {
    denylist: [/^\/api\//]
  }));
  workbox.registerRoute(({
    url,
    request
  }) => request.method !== "GET" || url.pathname.startsWith("/api/telegram/db/events") || url.pathname.startsWith("/api/telegram/configure") || url.pathname.startsWith("/api/telegram/claim-polling") || url.pathname.startsWith("/api/telegram/stop") || url.pathname.startsWith("/api/telegram/test-admin-message") || url.pathname.startsWith("/api/github/") || url.pathname.startsWith("/api/ai/"), new workbox.NetworkOnly(), 'GET');
  workbox.registerRoute(({
    request
  }) => request.mode === "navigate", new workbox.NetworkFirst({
    "cacheName": "safari-visited-pages-v1",
    "networkTimeoutSeconds": 3,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 60,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(({
    url,
    request
  }) => request.method === "GET" && (url.pathname === "/api/telegram/db/bootstrap" || url.pathname === "/api/telegram/db/version" || url.pathname === "/api/telegram/db/voice-index" || url.pathname === "/api/app-version" || url.pathname.endsWith("/live-db.json")), new workbox.NetworkFirst({
    "cacheName": "safari-catalog-api-v1",
    "networkTimeoutSeconds": 3,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 40,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(({
    url,
    request
  }) => request.method === "GET" && (url.pathname.startsWith("/api/telegram/db/media/") || url.pathname.startsWith("/api/telegram/db/voice-clip/")), new workbox.CacheFirst({
    "cacheName": "safari-media-voice-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 350,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(({
    url,
    request
  }) => request.method === "GET" && url.pathname.startsWith("/api/weather"), new workbox.NetworkFirst({
    "cacheName": "safari-weather-api-v1",
    "networkTimeoutSeconds": 3,
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 30,
      maxAgeSeconds: 604800
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(({
    request
  }) => request.destination === "image", new workbox.CacheFirst({
    "cacheName": "safari-product-images-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 300,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "safari-fonts-cache-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 25,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
