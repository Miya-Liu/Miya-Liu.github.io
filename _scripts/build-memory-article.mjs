/**
 * One-off: extract Notion export body and emit simplified HTML for the blog post.
 * Run: node _scripts/build-memory-article.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

const notionGlob = fs
  .readdirSync(path.join(repoRoot, "notion_sources"))
  .find((n) => n.includes("341006dba2688032b7dfca104dd6b635"));
if (!notionGlob) throw new Error("Notion source not found");
const notionPath = path.join(repoRoot, "notion_sources", notionGlob);

let html = fs.readFileSync(notionPath, "utf8");

const marker = '<div class="page-body">';
const i = html.indexOf(marker);
const end = html.lastIndexOf("</div></article>");
if (i === -1 || end === -1) throw new Error("Could not find page-body bounds");
let body = html.slice(i + marker.length, end);

/** Unwrap <div style="display:contents">…</div> using balanced </div> matching (innermost-first via repeat). */
function unwrapDisplayContents(html) {
  let s = html;
  const openTag = /<div style="display:contents"[^>]*>/gi;
  for (let iter = 0; iter < 2000; iter++) {
    let replaced = false;
    const matches = [...s.matchAll(openTag)];
    for (const m of matches) {
      const start = m.index;
      const openLen = m[0].length;
      const afterOpen = start + openLen;
      let depth = 1;
      let i = afterOpen;
      let closeEnd = -1;
      while (i < s.length && depth > 0) {
        const nextOpen = s.indexOf("<div", i);
        const nextClose = s.indexOf("</div>", i);
        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth += 1;
          i = nextOpen + 4;
        } else {
          depth -= 1;
          if (depth === 0) {
            closeEnd = nextClose + "</div>".length;
            break;
          }
          i = nextClose + "</div>".length;
        }
      }
      if (closeEnd === -1) continue;
      const inner = s.slice(afterOpen, closeEnd - "</div>".length);
      if (inner.includes('style="display:contents"')) continue;
      s = s.slice(0, start) + inner + s.slice(closeEnd);
      replaced = true;
      break;
    }
    if (!replaced) break;
  }
  return s;
}

body = unwrapDisplayContents(body);

// Decode common entities used in notion export
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// Replace mangled mojibake from export (keeps newlines — use for mermaid / code)
function fixTextNoCollapse(s) {
  return decodeEntities(s)
    .replace(/\uFFFD/g, "") // replacement char
    .replace(/Let.s talk about memory of agents in real/gi, "Let's talk about memory of agents in real")
    .replace(/\?\?/g, "→")
    .replace(/ �� /g, " — ")
    .replace(/��/g, "→")
    .replace(/User �� e/g, "User — e")
    .replace(/ �� /g, " → ")
    .replace(/�� /g, "→ ")
    .replace(/ ��/g, " →")
    .replace(/walk �� /g, "walk — ")
    .replace(/Local �� /g, "Local — ")
    .replace(/�� used for/g, "— used for")
    .replace(/guidance �� /g, "guidance — ")
    .replace(/outcomes �� /g, "outcomes — ")
    .replace(/who\/why\/when ��/g, "who/why/when —")
    .replace(/etc\.? �� /g, "etc. — ")
    .replace(/point\?outside/g, "point outside")
    .replace(/merged into the same\?/g, "merged into the same ")
    .replace(/\?instruction load\?/g, " instruction load ")
    .replace(/\?together with the\?/g, " together with the ")
    .replace(/\?memory dir\?/g, " memory dir ")
    .replace(/\?getMemoryFiles\(\)\?/g, " getMemoryFiles() ")
    .replace(/\?\(when not disabled\)\./g, " (when not disabled).")
    .replace(/Facts about the\?user.s role/g, "Facts about the user's role")
    .replace(/\?so the assistant/g, " so the assistant")
    .replace(/\?\(combined mode\): always\?/g, "(combined mode): always ")
    .replace(/\?Save when/g, " Save when")
    .replace(/\?this\?/g, " this ")
    .replace(/Non-derivable\?info/g, "Non-derivable info")
    .replace(/\?not\?/g, " not ")
    .replace(/Scope:\?\s*/g, "Scope: ")
    .replace(/\?or\?\s*/g, " or ")
    .replace(/bias toward\?\s*/g, "bias toward ")
    .replace(/about how to work\?/g, "about how to work — ")
    .replace(/corrections\?\s*and\?/g, "corrections and ")
    .replace(/Scope:\?\s*default\?/g, "Scope: default ")
    .replace(/\?only when/g, " only when")
    .replace(/external systems\?\s*\(/g, "external systems (")
    .replace(/\?outside\?\s*the repo/g, " outside the repo")
    .replace(/Step 1\?\s*/g, "Step 1 — ")
    .replace(/Step 2\?\s*/g, "Step 2 — ")
    .replace(/\?\s*one-line hook/g, " — one-line hook")
    .replace(/loaded into your system prompt\?\s*/g, "loaded into your system prompt — ")
    .replace(/\?\s*lines after/g, " — lines after")
    .replace(/\(\?\s*learning/g, "(→ learning")
    .replace(/\(\?\s*feature request\)/g, "(→ feature request)")
    .replace(/\(\?\s*learning with/g, "(→ learning with")
    .replace(/\(\?\s*error entry\)/g, "(→ error entry)");
}

/** fixText for non-mermaid (collapses newlines for prose in tables etc.) */
function fixText(s) {
  return fixTextNoCollapse(s).replace(/\n/g, " ");
}

// Remove table_of_contents nav block
body = body.replace(
  /<nav[^>]*class="[^"]*table_of_contents[^"]*"[^>]*>[\s\S]*?<\/nav>/gi,
  ""
);

// Remove notion property header inside pasted article (if any slipped)
body = body.replace(/<header>[\s\S]*?<\/header>/i, "");

// Convert pre/code mermaid to figure.memory-mermaid-figure
body = body.replace(
  /<pre[^>]*>\s*<code[^>]*class="language-mermaid"[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
  (_, code) => {
    const cleaned = fixTextNoCollapse(code.trim()).replace(/<br\s*\/?>/gi, "\n");
    return `<figure class="memory-mermaid-figure"><div class="mermaid">\n${cleaned}\n</div></figure>`;
  }
);

// Fix typos in mermaid source
body = body.replace(/relevanc-ranked/g, "relevance-ranked");
body = body.replace(/context windown/g, "context window");

// Convert remaining pre>code blocks to class="code" or keep as pre.code
body = body.replace(/<pre([^>]*)class="code[^"]*"([^>]*)>/gi, '<pre$1class="memory-inline-code"$2>');

// Simplify empty class attrs
body = body.replace(/\sclass=""/g, "");

function replaceAllWhileChanging(pattern, replacement, str) {
  let s = str;
  let prev;
  do {
    prev = s;
    s = s.replace(pattern, replacement);
  } while (s !== prev);
  return s;
}

// Nested blue inside gray: replace innermost blue figures first (repeat)
const blueCallout =
  /<figure class="block-color-blue_background callout"[^>]*>\s*<div style="font-size:1\.5em">\s*<span class="icon">[^<]*<\/span>\s*<\/div>\s*<div style="width:100%">([\s\S]*?)<\/div>\s*<\/figure>/gi;
body = replaceAllWhileChanging(
  blueCallout,
  '<aside class="memory-callout memory-callout-note">$1</aside>',
  body
);

const grayCallout =
  /<figure class="block-color-gray_background callout"[^>]*>[\s\S]*?<div style="font-size:1\.5em"><span class="icon">[^<]*<\/span><\/div><div style="width:100%">([\s\S]*?)<\/div><\/figure>/gi;
body = replaceAllWhileChanging(
  grayCallout,
  '<aside class="memory-callout">$1</aside>',
  body
);

body = body.replace(/<\/aside>\s*<\/div>\s*<\/figure>/g, "</aside>");

// Link to local File System Design page
body = body.replace(
  /<a href="File%20System%20Design%20344006dba268800bbcf2e6460ec3f708\.html">[^<]*<\/a>/,
  '<a href="../notion_sources/File System Design 344006dba268800bbcf2e6460ec3f708.html">File System Design</a>'
);

// Remove prism script tags inside body
body = body.replace(/<script[^>]*prism[^>]*><\/script>/gi, "");
body = body.replace(/<link[^>]*prism[^>]*>/gi, "");

// details/summary: keep as-is for long prompts (native HTML)

body = body.replace(
  /\[Agent Skills spec\]\(https:\/\/agentskills\.io\/specification\]/g,
  "[Agent Skills spec](https://agentskills.io/specification)"
);
body = body.replace(/skill_name\/-->/g, "skill_name/ -->");
body = body.replace(/promted-to-skill/g, "promoted-to-skill");
body = body.replace(
  /Note: \[Agent Skills spec\]\(https:\/\/agentskills\.io\/specification\)/g,
  'Note: <a href="https://agentskills.io/specification">Agent Skills spec</a>'
);

// Article body only — TOC sits outside .post in .post-page-layout (see wrapPostPageLayout)
const out = `<!-- Auto-built from Notion export; edit source in notion_sources -->
<section class="memory-article-body">
${body}
</section>`;

const outPath = path.join(repoRoot, "_scripts", "memory-article-body.fragment.html");
fs.writeFileSync(outPath, out, "utf8");
console.log("Wrote", outPath, "bytes", fs.statSync(outPath).size);

const postPath = path.join(repoRoot, "posts", "Openclaw_Memory_Real.html");
let postHtml = fs.readFileSync(postPath, "utf8");
const articleStart = postHtml.indexOf('<article class="post memory-post');
if (articleStart === -1) throw new Error("article not found");
const postHeaderClose = postHtml.indexOf("</header>", articleStart);
if (postHeaderClose === -1) throw new Error("post header end not found");
const insertAt = postHeaderClose + "</header>".length;
const footNeedle = "\n            <footer>";
const footPos = postHtml.indexOf(footNeedle, articleStart);
if (footPos === -1) throw new Error("article footer not found");
postHtml =
  postHtml.slice(0, insertAt) + "\n\n" + out.trim() + "\n\n" + postHtml.slice(footPos);
if (!/<article class="post memory-post has-toc">/.test(postHtml)) {
  postHtml = postHtml.replace(
    /<article class="post memory-post">/,
    '<article class="post memory-post has-toc">'
  );
}

function wrapPostPageLayout(html) {
  if (html.includes("post-page-layout")) return html;
  let h = html.replace(
    /<div id="main">\s*\n\s*<article class="post memory-post has-toc">/,
    '<div id="main">\n        <div class="post-page-layout">\n        <article class="post memory-post has-toc">'
  );
  h = h.replace(
    /\n\s*<\/article>\s*\n\s*<\/div>\s*\n\s*<!-- Footer -->/,
    "\n        </article>\n        <aside class=\"post-toc-wrap\" aria-label=\"On this page\">\n          <nav class=\"post-toc\" id=\"post-toc-nav\"></nav>\n        </aside>\n        </div>\n    </div>\n    <!-- Footer -->"
  );
  return h;
}
postHtml = wrapPostPageLayout(postHtml);
fs.writeFileSync(postPath, postHtml, "utf8");
console.log("Merged into posts/Openclaw_Memory_Real.html");
