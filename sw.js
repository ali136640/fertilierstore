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
    "revision": "5300bef627776cfe40aebad4eb455989"
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
    "url": "assets/zeolite_sugar_mesh_1794572563027-CDdWOU13.jpg",
    "revision": null
  }, {
    "url": "assets/worm_tea_liquid_1794572563137-Bywo8TSy.jpg",
    "revision": null
  }, {
    "url": "assets/vermicompost_grade_a_1794572561601-BDZABCfD.jpg",
    "revision": null
  }, {
    "url": "assets/traditional_compost_1794572562702-CLvLAfR1.jpg",
    "revision": null
  }, {
    "url": "assets/live_earthworms_1794572563487-Dyk4Uzd4.jpg",
    "revision": null
  }, {
    "url": "assets/index-xkbOQTh1.js",
    "revision": null
  }, {
    "url": "assets/index-Ch2UpRa7.css",
    "revision": null
  }, {
    "url": "assets/coffee_substrate_1794572564729-CSvR1ryM.jpg",
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
