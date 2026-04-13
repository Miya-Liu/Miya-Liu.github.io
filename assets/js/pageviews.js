/**
 * Increments and displays per-page read counts via Firebase Realtime Database.
 * Requires pageviews-config.js before this file.
 */
(function () {
  "use strict";

  function initStatNodes() {
    var stats = Array.prototype.slice.call(document.querySelectorAll(".pageview-stat"));
    stats.forEach(function (el) {
      el.removeAttribute("hidden");
      el.innerHTML = 'Read by <span class="pageview-count">—</span> readers';
    });
    return stats;
  }

  function getCountSpans(stats) {
    return stats
      .map(function (el) {
        return el.querySelector(".pageview-count");
      })
      .filter(Boolean);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = function () {
        reject(new Error("Failed to load " + src));
      };
      document.head.appendChild(s);
    });
  }

  /** Stable key from URL path (safe for Firebase RTDB paths). */
  function pageKeyFromLocation() {
    var p = window.location.pathname || "/";
    if (p.length > 1 && p.charAt(p.length - 1) === "/") {
      p = p.slice(0, -1);
    }
    if (p.endsWith("/index.html")) {
      p = p.slice(0, -10) || "/";
    }
    if (p.endsWith(".html")) {
      /* keep full path incl. folders */
    }
    p = p.replace(/^\/+/, "") || "index";
    return p.replace(/[.#$\[\]]/g, "_").replace(/\//g, "__");
  }

  function showCount(spans, n) {
    var text = typeof n === "number" ? String(n) : "—";
    spans.forEach(function (el) {
      el.textContent = text;
    });
  }

  function run() {
    var stats = initStatNodes();
    if (!stats.length) {
      return;
    }
    var countSpans = getCountSpans(stats);

    var cfg = window.__PAGE_VIEWS__;
    if (!cfg || !cfg.enabled || !cfg.firebaseConfig || !cfg.firebaseConfig.databaseURL) {
      showCount(countSpans, null);
      return;
    }
    var fc = cfg.firebaseConfig;
    if (!fc.apiKey || !fc.projectId) {
      showCount(countSpans, null);
      return;
    }

    var v = "10.7.1";
    var base = "https://www.gstatic.com/firebasejs/" + v + "/";

    loadScript(base + "firebase-app-compat.js")
      .then(function () {
        return loadScript(base + "firebase-database-compat.js");
      })
      .then(function () {
        /* global firebase */
        if (typeof firebase === "undefined") {
          throw new Error("firebase not available");
        }
        if (!firebase.apps.length) {
          firebase.initializeApp(fc);
        }
        var db = firebase.database();
        var ref = db.ref("pageviews/" + pageKeyFromLocation());

        ref.transaction(
          function (current) {
            return (current || 0) + 1;
          },
          function (error, committed, snapshot) {
            if (error) {
              console.warn("[pageviews]", error);
              showCount(countSpans, null);
              return;
            }
            if (!committed) {
              ref.once("value").then(function (snap) {
                showCount(countSpans, snap.val());
              });
              return;
            }
            var val = snapshot && typeof snapshot.val === "function" ? snapshot.val() : null;
            if (val == null) {
              ref.once("value").then(function (snap) {
                showCount(countSpans, snap.val());
              });
            } else {
              showCount(countSpans, val);
            }
          },
          false
        );
      })
      .catch(function (err) {
        console.warn("[pageviews]", err);
        showCount(countSpans, null);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
