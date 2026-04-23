/**
 * Insert the same .content-rights line after #footer pageview on post pages.
 * Run from repo root: node _scripts/inject-content-rights.mjs
 */
import fs from "node:fs";
import path from "node:path";

const LINE =
  "Writing is for reading on this site only; please do not republish without permission. © Miya Liu.";

const blocks = [
  {
    re: /(\s{6}<p class="pageview-stat" hidden><span id="pageview-count">—<\/span> views<\/p>)\r?\n(\s{6}<ul class="icons">)/,
    rights: `      <p class="content-rights" role="note">${LINE}</p>`,
  },
  {
    re: /(\s{8}<p class="pageview-stat" hidden><span id="pageview-count">—<\/span> views<\/p>)\r?\n(\s{8}<ul class="icons">)/,
    rights: `        <p class="content-rights" role="note">${LINE}</p>`,
  },
  {
    re: /(\s{10}<p class="pageview-stat" hidden><span id="pageview-count">—<\/span> views<\/p>)\r?\n(\s{10}<ul class="icons">)/,
    rights: `          <p class="content-rights" role="note">${LINE}</p>`,
  },
];

const dir = path.join(process.cwd(), "posts");
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith(".html")) continue;
  const fp = path.join(dir, name);
  let s = fs.readFileSync(fp, "utf8");
  if (s.includes("content-rights")) continue;
  const eol = s.includes("\r\n") ? "\r\n" : "\n";
  let done = false;
  for (const { re, rights } of blocks) {
    if (!re.test(s)) continue;
    s = s.replace(re, (_, g1, g2) => `${g1}${eol}${rights}${eol}${g2}`);
    fs.writeFileSync(fp, s);
    console.log("updated", name);
    done = true;
    break;
  }
  if (!done) console.warn("no match:", name);
}
