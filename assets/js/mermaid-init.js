/**
 * Lazy-load Mermaid and render charts only when needed.
 * This avoids blocking initial page load on slow CDN connections.
 */
(function () {
  "use strict";

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

  function ensureMermaid() {
    if (typeof mermaid !== "undefined") {
      return Promise.resolve();
    }
    var cdns = [
      "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js",
      "https://unpkg.com/mermaid@10/dist/mermaid.min.js",
    ];
    return loadScript(cdns[0]).catch(function () {
      return loadScript(cdns[1]);
    });
  }

  function runMermaid() {
    var nodes = document.querySelectorAll(".mermaid");
    if (!nodes.length) return;

    ensureMermaid()
      .then(function () {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: "neutral",
          themeVariables: {
            fontSize: "9px",
          },
          flowchart: {
            htmlLabels: true,
            useMaxWidth: true,
            curve: "linear",
            nodeSpacing: 24,
            rankSpacing: 30,
          },
        });

        var result = mermaid.run({ querySelector: ".mermaid" });
        if (result && typeof result.then === "function") {
          result.catch(function (err) {
            console.warn("[mermaid]", err);
          });
        }
      })
      .catch(function (err) {
        /* Keep page usable even if Mermaid CDN is slow/down. */
        document.querySelectorAll(".memory-mermaid-figure").forEach(function (el) {
          el.setAttribute("hidden", "hidden");
        });
        console.warn("[mermaid]", err);
      });
  }

  function scheduleRenderWhenVisible() {
    var firstMermaid = document.querySelector(".mermaid");
    if (!firstMermaid) return;

    if (!("IntersectionObserver" in window)) {
      runMermaid();
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          runMermaid();
        });
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(firstMermaid);
  }

  function start() {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(scheduleRenderWhenVisible, { timeout: 2000 });
    } else {
      setTimeout(scheduleRenderWhenVisible, 0);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
