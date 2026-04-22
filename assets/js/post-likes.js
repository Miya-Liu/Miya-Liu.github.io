/**
 * Footer likes + post comments/replies/reactions.
 * Backed by Firebase Realtime Database with localStorage client-side guardrails.
 */
(function () {
  "use strict";

  var STORAGE_LIKE_PREFIX = "thought_recorder_liked_";
  var STORAGE_COMMENT_VOTE_PREFIX = "thought_recorder_comment_vote_";
  var STORAGE_COMMENT_NAME_KEY = "thought_recorder_comment_name";
  var COMMENTS_SECTION_ID = "post-comments";

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

  function pageKeyFromPathname(pathname) {
    var p = pathname || "/";
    if (p.length > 1 && p.charAt(p.length - 1) === "/") p = p.slice(0, -1);
    if (p.endsWith("/index.html")) p = p.slice(0, -10) || "/";
    p = p.replace(/^\/+/, "") || "index";
    return p.replace(/[.#$\[\]]/g, "_").replace(/\//g, "__");
  }

  function canonicalPathForArticle(article) {
    if (document.body.classList.contains("blog-page")) {
      var a =
        article.querySelector("header .title h2 a[href]") ||
        article.querySelector("a.image.featured[href]") ||
        article.querySelector("footer ul.actions a.button[href]");
      if (!a) return null;
      try {
        return new URL(a.getAttribute("href"), window.location.href).pathname;
      } catch (e) {
        return null;
      }
    }
    return window.location.pathname || "/";
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, val) {
    try {
      window.localStorage.setItem(key, val);
    } catch (e) {
      /* ignore */
    }
  }

  function formatTime(ts) {
    if (!ts) return "";
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString();
  }

  function getDatabase(fc) {
    if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length) {
      return Promise.resolve(firebase.database());
    }
    return new Promise(function (resolve, reject) {
      var attempts = 0;
      var maxAttempts = 100;
      function poll() {
        if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length) {
          resolve(firebase.database());
          return;
        }
        if (attempts >= maxAttempts) {
          var v = "10.7.1";
          var base = "https://www.gstatic.com/firebasejs/" + v + "/";
          loadScript(base + "firebase-app-compat.js")
            .then(function () {
              return loadScript(base + "firebase-database-compat.js");
            })
            .then(function () {
              if (typeof firebase === "undefined") {
                reject(new Error("firebase not available"));
                return;
              }
              if (!firebase.apps.length) firebase.initializeApp(fc);
              resolve(firebase.database());
            })
            .catch(reject);
          return;
        }
        attempts += 1;
        window.setTimeout(poll, 25);
      }
      poll();
    });
  }

  function getLocalInteractionsConfig() {
    var cfg = window.__LOCAL_INTERACTIONS__;
    if (!cfg || !cfg.enabled || !cfg.apiBase) return null;
    return {
      apiBase: String(cfg.apiBase).replace(/\/+$/, ""),
      pollMs: Number(cfg.pollMs) > 0 ? Number(cfg.pollMs) : 1500,
    };
  }

  function createLocalFileDb(localCfg) {
    function request(method, path, body) {
      return fetch(localCfg.apiBase + path, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      }).then(function (r) {
        if (!r.ok) throw new Error("Local API " + method + " " + path + " failed: " + r.status);
        return r.json();
      });
    }

    function snapshotOf(v) {
      return {
        val: function () {
          return v;
        },
      };
    }

    function LocalRef(path) {
      this._path = path;
      this._poll = null;
      this._lastJson = null;
    }

    LocalRef.prototype._read = function () {
      var encoded = encodeURIComponent(this._path);
      return request("GET", "/api/get?path=" + encoded).then(function (res) {
        return res.value;
      });
    };

    LocalRef.prototype.on = function (eventName, cb) {
      if (eventName !== "value") return;
      var self = this;
      function tick() {
        self
          ._read()
          .then(function (v) {
            var j = JSON.stringify(v);
            if (j !== self._lastJson) {
              self._lastJson = j;
              cb(snapshotOf(v));
            }
          })
          .catch(function (err) {
            console.warn("[local-file-db]", err);
          });
      }
      tick();
      this._poll = window.setInterval(tick, localCfg.pollMs);
    };

    LocalRef.prototype.once = function (eventName) {
      if (eventName !== "value") return Promise.resolve(snapshotOf(null));
      return this._read().then(function (v) {
        return snapshotOf(v);
      });
    };

    LocalRef.prototype.transaction = function (updateFn, onComplete) {
      var self = this;
      this._read()
        .then(function (current) {
          var next = updateFn(current);
          return request("POST", "/api/set", { path: self._path, value: next }).then(function () {
            return next;
          });
        })
        .then(function (next) {
          if (typeof onComplete === "function") onComplete(null, true, snapshotOf(next));
        })
        .catch(function (err) {
          if (typeof onComplete === "function") onComplete(err, false, snapshotOf(null));
        });
    };

    LocalRef.prototype.push = function (value) {
      return request("POST", "/api/push", { path: this._path, value: value }).then(function (res) {
        return { key: res.key };
      });
    };

    return {
      ref: function (path) {
        return new LocalRef(path);
      },
    };
  }

  function initHeartsWithDb(db) {
    var hearts = document.querySelectorAll("article.post > footer ul.stats a.fa-heart");
    for (var i = 0; i < hearts.length; i++) bindHeart(hearts[i], db);
  }

  function bindHeart(anchor, db) {
    var article = anchor.closest("article.post");
    if (!article) return;
    var path = canonicalPathForArticle(article);
    if (!path) return;

    var pageKey = pageKeyFromPathname(path);
    var likeStorageKey = STORAGE_LIKE_PREFIX + pageKey;
    var ref = db.ref("likes/" + pageKey);

    while (anchor.firstChild) anchor.removeChild(anchor.firstChild);
    var countSpan = document.createElement("span");
    countSpan.className = "post-like-count";
    countSpan.setAttribute("aria-hidden", "true");
    anchor.appendChild(countSpan);

    anchor.setAttribute("role", "button");
    anchor.setAttribute("href", "#");
    anchor.setAttribute("aria-pressed", storageGet(likeStorageKey) === "1" ? "true" : "false");
    if (storageGet(likeStorageKey) === "1") anchor.classList.add("is-liked");

    ref.on("value", function (snap) {
      var v = snap.val();
      countSpan.textContent = String(typeof v === "number" && !isNaN(v) ? v : 0);
    });

    anchor.addEventListener(
      "click",
      function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (storageGet(likeStorageKey) === "1") return;

        ref.transaction(
          function (current) {
            return (current || 0) + 1;
          },
          function (error) {
            if (error) {
              console.warn("[post-likes]", error);
              return;
            }
            storageSet(likeStorageKey, "1");
            anchor.classList.add("is-liked");
            anchor.setAttribute("aria-pressed", "true");
          },
          false
        );
      },
      true
    );

    anchor.addEventListener(
      "touchend",
      function (e) {
        e.stopPropagation();
      },
      false
    );
  }

  function initHeartsOffline() {
    var hearts = document.querySelectorAll("article.post > footer ul.stats a.fa-heart");
    for (var i = 0; i < hearts.length; i++) {
      var anchor = hearts[i];
      var article = anchor.closest("article.post");
      if (!article) continue;
      var path = canonicalPathForArticle(article);
      if (!path) continue;
      var pageKey = pageKeyFromPathname(path);
      var likeStorageKey = STORAGE_LIKE_PREFIX + pageKey;

      while (anchor.firstChild) anchor.removeChild(anchor.firstChild);
      var countSpan = document.createElement("span");
      countSpan.className = "post-like-count";
      countSpan.textContent = "—";
      anchor.appendChild(countSpan);
      anchor.setAttribute("href", "#");
      anchor.setAttribute("role", "button");
      if (storageGet(likeStorageKey) === "1") {
        anchor.classList.add("is-liked");
        anchor.setAttribute("aria-pressed", "true");
      } else {
        anchor.setAttribute("aria-pressed", "false");
      }

      anchor.addEventListener(
        "click",
        (function (a, key, span) {
          return function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (storageGet(key) === "1") return;
            storageSet(key, "1");
            a.classList.add("is-liked");
            a.setAttribute("aria-pressed", "true");
            span.textContent = "1";
          };
        })(anchor, likeStorageKey, countSpan),
        true
      );
    }
  }

  function initCommentAnchors(db, hasFirebase) {
    var comments = document.querySelectorAll("article.post > footer ul.stats a.fa-comment");
    for (var i = 0; i < comments.length; i++) {
      var anchor = comments[i];
      var article = anchor.closest("article.post");
      if (!article) continue;
      var path = canonicalPathForArticle(article);
      if (!path) continue;
      var pageKey = pageKeyFromPathname(path);

      while (anchor.firstChild) anchor.removeChild(anchor.firstChild);
      var countSpan = document.createElement("span");
      countSpan.className = "post-comment-count";
      countSpan.setAttribute("aria-hidden", "true");
      countSpan.textContent = hasFirebase ? "0" : "—";
      anchor.appendChild(countSpan);
      anchor.setAttribute("role", "button");

      if (document.body.classList.contains("blog-page")) {
        anchor.setAttribute("href", path + "#" + COMMENTS_SECTION_ID);
      } else {
        anchor.setAttribute("href", "#" + COMMENTS_SECTION_ID);
        anchor.addEventListener("click", function () {
          var section = document.getElementById(COMMENTS_SECTION_ID);
          if (section && section.scrollIntoView) {
            section.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      }

      if (hasFirebase && db) {
        db.ref("comments/" + pageKey).on("value", (function (span) {
          return function (snap) {
            var v = snap.val() || {};
            span.textContent = String(Object.keys(v).length);
          };
        })(countSpan));
      }
    }
  }

  function createSection(tag, cls) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  }

  function initComments(db) {
    if (!document.body.classList.contains("single")) return;
    var article = document.querySelector("#main article.post");
    if (!article || article.querySelector(".post-comments-section")) return;

    var pageKey = pageKeyFromPathname(window.location.pathname || "/");
    var commentsRef = db.ref("comments/" + pageKey);

    var section = createSection("section", "post-comments-section");
    section.id = COMMENTS_SECTION_ID;
    var title = createSection("h3", "post-comments-title");
    title.textContent = "Comments";
    section.appendChild(title);

    var note = createSection("p", "post-comments-note");
    note.textContent = "Leave a comment, reply to others, and react with like/dislike.";
    section.appendChild(note);

    var form = createSection("form", "post-comment-form");
    form.setAttribute("novalidate", "novalidate");
    var nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.maxLength = 40;
    nameInput.placeholder = "Your name (optional)";
    nameInput.value = storageGet(STORAGE_COMMENT_NAME_KEY) || "";

    var textInput = document.createElement("textarea");
    textInput.placeholder = "Share your thoughts...";
    textInput.maxLength = 2000;
    textInput.required = true;

    var formActions = createSection("div", "post-comment-form-actions");
    var submitBtn = document.createElement("button");
    submitBtn.type = "submit";
    submitBtn.className = "button small";
    submitBtn.textContent = "Post Comment";
    var status = createSection("span", "post-comment-status");
    formActions.appendChild(submitBtn);
    formActions.appendChild(status);

    form.appendChild(nameInput);
    form.appendChild(textInput);
    form.appendChild(formActions);
    section.appendChild(form);

    var list = createSection("div", "post-comments-list");
    section.appendChild(list);
    article.appendChild(section);

    function buildTree(map) {
      var comments = Object.keys(map || {}).map(function (id) {
        var c = map[id] || {};
        return {
          id: id,
          author: (c.author || "Anonymous").toString(),
          text: (c.text || "").toString(),
          createdAt: Number(c.createdAt) || 0,
          parentId: c.parentId ? String(c.parentId) : "",
          likes: Number(c.likes) || 0,
          dislikes: Number(c.dislikes) || 0,
        };
      });
      comments.sort(function (a, b) {
        return a.createdAt - b.createdAt;
      });

      var byId = {};
      var roots = [];
      for (var i = 0; i < comments.length; i++) {
        comments[i].children = [];
        byId[comments[i].id] = comments[i];
      }
      for (var j = 0; j < comments.length; j++) {
        var node = comments[j];
        if (node.parentId && byId[node.parentId]) byId[node.parentId].children.push(node);
        else roots.push(node);
      }
      return roots;
    }

    function voteRef(commentId) {
      return db.ref("comments/" + pageKey + "/" + commentId);
    }

    function getVoteState(commentId) {
      return storageGet(STORAGE_COMMENT_VOTE_PREFIX + commentId) || "";
    }

    function setVoteState(commentId, state) {
      storageSet(STORAGE_COMMENT_VOTE_PREFIX + commentId, state);
    }

    function applyVote(commentId, next) {
      var prev = getVoteState(commentId);
      if (prev === next) return;

      voteRef(commentId).transaction(
        function (curr) {
          if (!curr) return curr;
          var likes = Number(curr.likes) || 0;
          var dislikes = Number(curr.dislikes) || 0;

          if (prev === "like") likes = Math.max(0, likes - 1);
          if (prev === "dislike") dislikes = Math.max(0, dislikes - 1);

          if (next === "like") likes += 1;
          if (next === "dislike") dislikes += 1;

          curr.likes = likes;
          curr.dislikes = dislikes;
          return curr;
        },
        function (error, committed) {
          if (error || !committed) {
            console.warn("[post-comments] vote", error || "not committed");
            return;
          }
          setVoteState(commentId, next);
        },
        false
      );
    }

    function renderComment(node, depth) {
      var item = createSection("div", "post-comment-item");
      if (depth > 0) item.classList.add("is-reply");

      var header = createSection("div", "post-comment-header");
      var author = createSection("span", "post-comment-author");
      author.textContent = node.author || "Anonymous";
      var when = createSection("time", "post-comment-time");
      when.textContent = formatTime(node.createdAt);
      header.appendChild(author);
      if (when.textContent) header.appendChild(when);

      var body = createSection("p", "post-comment-body");
      body.textContent = node.text;

      var actions = createSection("div", "post-comment-actions");
      var likeBtn = document.createElement("button");
      likeBtn.type = "button";
      likeBtn.className = "post-comment-action";
      likeBtn.textContent = "Like (" + node.likes + ")";

      var dislikeBtn = document.createElement("button");
      dislikeBtn.type = "button";
      dislikeBtn.className = "post-comment-action";
      dislikeBtn.textContent = "Dislike (" + node.dislikes + ")";

      var replyBtn = document.createElement("button");
      replyBtn.type = "button";
      replyBtn.className = "post-comment-action";
      replyBtn.textContent = "Reply";

      var vote = getVoteState(node.id);
      if (vote === "like") likeBtn.classList.add("is-active");
      if (vote === "dislike") dislikeBtn.classList.add("is-active");

      likeBtn.addEventListener("click", function () {
        applyVote(node.id, "like");
      });
      dislikeBtn.addEventListener("click", function () {
        applyVote(node.id, "dislike");
      });

      actions.appendChild(likeBtn);
      actions.appendChild(dislikeBtn);
      actions.appendChild(replyBtn);

      var replyWrap = createSection("div", "post-comment-reply-wrap");
      replyWrap.hidden = true;
      var replyName = document.createElement("input");
      replyName.type = "text";
      replyName.maxLength = 40;
      replyName.placeholder = "Your name (optional)";
      replyName.value = storageGet(STORAGE_COMMENT_NAME_KEY) || "";
      var replyText = document.createElement("textarea");
      replyText.placeholder = "Write a reply...";
      replyText.maxLength = 2000;
      var replySubmit = document.createElement("button");
      replySubmit.type = "button";
      replySubmit.className = "button small";
      replySubmit.textContent = "Post Reply";
      var replyStatus = createSection("span", "post-comment-status");

      replyBtn.addEventListener("click", function () {
        replyWrap.hidden = !replyWrap.hidden;
        if (!replyWrap.hidden) replyText.focus();
      });

      replySubmit.addEventListener("click", function () {
        var text = replyText.value.trim();
        if (!text) {
          replyStatus.textContent = "Reply cannot be empty.";
          return;
        }
        var authorName = replyName.value.trim() || "Anonymous";
        storageSet(STORAGE_COMMENT_NAME_KEY, authorName);
        replySubmit.disabled = true;
        replyStatus.textContent = "Posting...";
        commentsRef
          .push({
            author: authorName.slice(0, 40),
            text: text.slice(0, 2000),
            createdAt: Date.now(),
            parentId: node.id,
            likes: 0,
            dislikes: 0,
          })
          .then(function () {
            replyText.value = "";
            replyWrap.hidden = true;
            replyStatus.textContent = "";
          })
          .catch(function (err) {
            console.warn("[post-comments]", err);
            replyStatus.textContent = "Failed to post reply.";
          })
          .finally(function () {
            replySubmit.disabled = false;
          });
      });

      replyWrap.appendChild(replyName);
      replyWrap.appendChild(replyText);
      replyWrap.appendChild(replySubmit);
      replyWrap.appendChild(replyStatus);

      item.appendChild(header);
      item.appendChild(body);
      item.appendChild(actions);
      item.appendChild(replyWrap);

      if (node.children && node.children.length) {
        var childList = createSection("div", "post-comment-children");
        for (var i = 0; i < node.children.length; i++) {
          childList.appendChild(renderComment(node.children[i], depth + 1));
        }
        item.appendChild(childList);
      }
      return item;
    }

    function renderAll(data) {
      list.innerHTML = "";
      var roots = buildTree(data || {});
      if (!roots.length) {
        var empty = createSection("p", "post-comments-empty");
        empty.textContent = "No comments yet. Be the first to comment.";
        list.appendChild(empty);
        return;
      }
      for (var i = 0; i < roots.length; i++) {
        list.appendChild(renderComment(roots[i], 0));
      }
    }

    commentsRef.on("value", function (snap) {
      renderAll(snap.val() || {});
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = textInput.value.trim();
      if (!text) {
        status.textContent = "Comment cannot be empty.";
        return;
      }
      var authorName = nameInput.value.trim() || "Anonymous";
      storageSet(STORAGE_COMMENT_NAME_KEY, authorName);
      submitBtn.disabled = true;
      status.textContent = "Posting...";

      commentsRef
        .push({
          author: authorName.slice(0, 40),
          text: text.slice(0, 2000),
          createdAt: Date.now(),
          parentId: "",
          likes: 0,
          dislikes: 0,
        })
        .then(function () {
          textInput.value = "";
          status.textContent = "";
        })
        .catch(function (err) {
          console.warn("[post-comments]", err);
          status.textContent = "Failed to post comment.";
        })
        .finally(function () {
          submitBtn.disabled = false;
        });
    });
  }

  function run() {
    var localCfg = getLocalInteractionsConfig();
    if (localCfg) {
      var localDb = createLocalFileDb(localCfg);
      initHeartsWithDb(localDb);
      initComments(localDb);
      initCommentAnchors(localDb, true);
      return;
    }

    var cfg = window.__PAGE_VIEWS__;
    var ok =
      cfg &&
      cfg.enabled &&
      cfg.firebaseConfig &&
      cfg.firebaseConfig.databaseURL &&
      cfg.firebaseConfig.apiKey &&
      cfg.firebaseConfig.projectId;

    if (!ok) {
      initHeartsOffline();
      if (document.body.classList.contains("single")) {
        var article = document.querySelector("#main article.post");
        if (article && !article.querySelector(".post-comments-section")) {
          var section = document.createElement("section");
          section.className = "post-comments-section";
          section.id = COMMENTS_SECTION_ID;
          var title = document.createElement("h3");
          title.className = "post-comments-title";
          title.textContent = "Comments";
          var note = document.createElement("p");
          note.className = "post-comments-note";
          note.textContent = "Enable Firebase in pageviews-config.js to turn on comments.";
          section.appendChild(title);
          section.appendChild(note);
          article.appendChild(section);
        }
      }
      initCommentAnchors(null, false);
      return;
    }

    getDatabase(cfg.firebaseConfig)
      .then(function (db) {
        initHeartsWithDb(db);
        initComments(db);
        initCommentAnchors(db, true);
      })
      .catch(function (err) {
        console.warn("[post-likes/comments]", err);
        initHeartsOffline();
        initCommentAnchors(null, false);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
