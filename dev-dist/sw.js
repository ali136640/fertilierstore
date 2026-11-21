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
    "url": "/fertilierstore/index.html",
    "revision": "0.r4ihlfm917o"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/fertilierstore/index.html"), {
    allowlist: [/^\/$/],
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
