/**
 * Right-column table of contents + scroll spy for long posts (.memory-post.has-toc).
 */
(function () {
  "use strict";

  function slugify(text) {
    var s = (text || "")
      .trim()
      .toLowerCase()
      .replace(/["'`]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return s || "section";
  }

  function init() {
    var article = document.querySelector("article.memory-post.has-toc");
    if (!article) return;

    var root = article.querySelector(".memory-article-body");
    var nav = document.getElementById("post-toc-nav");
    if (!root || !nav) return;

    var headings = root.querySelectorAll("h2, h3, h4");
    if (!headings.length) return;

    var used = new Set();
    Array.prototype.forEach.call(headings, function (h) {
      var id = h.id && h.id.trim();
      if (!id) {
        var base = slugify(h.textContent);
        id = base;
        var n = 0;
        while (document.getElementById(id) || used.has(id)) {
          n += 1;
          id = base + "-" + n;
        }
        h.id = id;
      }
      used.add(h.id);
    });

    var label = document.createElement("p");
    label.className = "post-toc-label";
    label.textContent = "On this page";
    nav.appendChild(label);

    var list = document.createElement("ul");
    list.className = "post-toc-list";

    var links = [];
    var stack = [];

    function headingLevel(el) {
      return parseInt(el.tagName.charAt(1), 10) || 2;
    }

    Array.prototype.forEach.call(headings, function (h) {
      var level = headingLevel(h);
      while (stack.length && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      var parentUl;
      if (!stack.length) {
        parentUl = list;
      } else {
        var ancestor = stack[stack.length - 1];
        if (!ancestor.nestedUl) {
          ancestor.nestedUl = document.createElement("ul");
          ancestor.nestedUl.className = "post-toc-nested";
          ancestor.li.appendChild(ancestor.nestedUl);
        }
        parentUl = ancestor.nestedUl;
      }

      var li = document.createElement("li");
      li.className = "post-toc-item post-toc-depth-" + level;
      var a = document.createElement("a");
      a.className = "post-toc-link";
      a.href = "#" + h.id;
      a.textContent = h.textContent.replace(/\s+/g, " ").trim();
      li.appendChild(a);
      parentUl.appendChild(li);
      links.push({ el: a, heading: h });
      stack.push({ level: level, li: li, nestedUl: null });
    });

    nav.appendChild(list);

    function setActive(id) {
      nav.querySelectorAll(".post-toc-item.is-active-branch").forEach(function (el) {
        el.classList.remove("is-active-branch");
      });
      links.forEach(function (item) {
        var on = item.heading.id === id;
        item.el.classList.toggle("is-active", on);
        var li = item.el.parentNode;
        if (li && li.classList) {
          li.classList.toggle("is-active", on);
        }
        if (on) item.el.setAttribute("aria-current", "location");
        else item.el.removeAttribute("aria-current");
      });
      var activeLi = null;
      links.forEach(function (item) {
        if (item.heading.id === id) activeLi = item.el.parentNode;
      });
      var cursor = activeLi;
      while (cursor && cursor !== nav) {
        if (cursor.classList && cursor.classList.contains("post-toc-item")) {
          cursor.classList.add("is-active-branch");
        }
        var ul = cursor.parentElement;
        if (!ul || ul.tagName !== "UL" || ul.parentElement === nav) break;
        cursor = ul.parentElement;
      }
    }

    var headerEl = document.getElementById("header");
    var headingEls = Array.prototype.slice.call(headings);

    function scrollPad() {
      var h = headerEl && headerEl.getBoundingClientRect().height;
      if (h && h > 0) return h;
      return 56;
    }

    /**
     * Last heading whose top has crossed the "reader line" below the fixed header.
     * Uses viewport coordinates only (sticky header safe).
     */
    function pickActive() {
      var line = scrollPad() + 10;
      var active = headingEls[0];
      for (var i = 0; i < headingEls.length; i++) {
        var rect = headingEls[i].getBoundingClientRect();
        if (rect.top <= line) {
          active = headingEls[i];
        }
      }

      var se = document.scrollingElement || document.documentElement;
      var scrollBottom = window.scrollY + window.innerHeight;
      var total = se.scrollHeight;
      var threshold = Math.max(120, window.innerHeight * 0.15);
      if (headingEls.length > 1 && scrollBottom >= total - threshold) {
        active = headingEls[headingEls.length - 1];
      }

      if (active && active.id) {
        setActive(active.id);
      }
    }

    var ticking = false;
    function onScrollOrLayout() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        pickActive();
        ticking = false;
      });
    }

    function afterLayoutShift() {
      pickActive();
      window.requestAnimationFrame(pickActive);
      window.setTimeout(pickActive, 80);
      window.setTimeout(pickActive, 320);
    }

    function bindScrollTargets() {
      window.addEventListener("scroll", onScrollOrLayout, { passive: true });
      document.addEventListener("scroll", onScrollOrLayout, {
        passive: true,
        capture: true,
      });
      var se = document.scrollingElement || document.documentElement;
      if (se) {
        se.addEventListener("scroll", onScrollOrLayout, { passive: true });
      }
      if (document.body) {
        document.body.addEventListener("scroll", onScrollOrLayout, {
          passive: true,
        });
      }
      if (window.visualViewport) {
        window.visualViewport.addEventListener("scroll", onScrollOrLayout, {
          passive: true,
        });
        window.visualViewport.addEventListener("resize", onScrollOrLayout);
      }
    }

    bindScrollTargets();
    window.addEventListener("resize", onScrollOrLayout);
    window.requestAnimationFrame(function () {
      pickActive();
      window.requestAnimationFrame(pickActive);
    });
    pickActive();
    window.addEventListener("load", function () {
      afterLayoutShift();
    });

    document.addEventListener("memorypost-mermaid-rendered", afterLayoutShift);

    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(onScrollOrLayout);
      ro.observe(root);
    }

    if ("IntersectionObserver" in window) {
      var topMargin = "-" + Math.round(scrollPad() + 12) + "px";
      var io = new IntersectionObserver(
        function () {
          onScrollOrLayout();
        },
        {
          root: null,
          rootMargin: topMargin + " 0px -82% 0px",
          threshold: [0, 0.05, 0.25, 0.5, 0.75, 1],
        }
      );
      headingEls.forEach(function (h) {
        io.observe(h);
      });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        afterLayoutShift();
      });
    }

    if ("onhashchange" in window) {
      window.addEventListener("hashchange", function () {
        window.requestAnimationFrame(function () {
          pickActive();
          window.setTimeout(pickActive, 100);
          window.setTimeout(pickActive, 350);
        });
      });
    }

    nav.addEventListener(
      "click",
      function (e) {
        var t = e.target;
        if (t.tagName !== "A" || !t.closest(".post-toc-list")) return;
        window.requestAnimationFrame(function () {
          pickActive();
        });
        window.setTimeout(pickActive, 120);
        window.setTimeout(pickActive, 400);
      },
      false
    );

  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
