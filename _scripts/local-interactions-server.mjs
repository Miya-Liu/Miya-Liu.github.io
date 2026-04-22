import fs from "fs";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const dataDir = path.join(repoRoot, "_local_data");
const dataFile = path.join(dataDir, "interactions.json");
const port = Number(process.env.LOCAL_INTERACTIONS_PORT || 8787);

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify({ likes: {}, comments: {} }, null, 2));
  }
}

function readStore() {
  ensureStore();
  try {
    return JSON.parse(fs.readFileSync(dataFile, "utf8"));
  } catch {
    return { likes: {}, comments: {} };
  }
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(dataFile, JSON.stringify(store, null, 2));
}

function getAtPath(obj, rawPath) {
  const parts = String(rawPath || "")
    .split("/")
    .filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return null;
    cur = cur[p];
  }
  return cur == null ? null : cur;
}

function setAtPath(obj, rawPath, value) {
  const parts = String(rawPath || "")
    .split("/")
    .filter(Boolean);
  if (!parts.length) return;
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res, code, payload) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function randomKey() {
  return (
    "c_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 10)
  );
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  const url = new URL(req.url || "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, dataFile });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/get") {
    const p = url.searchParams.get("path") || "";
    const store = readStore();
    sendJson(res, 200, { ok: true, value: getAtPath(store, p) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/set") {
    const body = await parseBody(req);
    const p = String(body.path || "");
    const store = readStore();
    setAtPath(store, p, body.value ?? null);
    writeStore(store);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/push") {
    const body = await parseBody(req);
    const p = String(body.path || "");
    const store = readStore();
    const current = getAtPath(store, p);
    const key = randomKey();
    const next = current && typeof current === "object" ? { ...current } : {};
    next[key] = body.value ?? null;
    setAtPath(store, p, next);
    writeStore(store);
    sendJson(res, 200, { ok: true, key });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

ensureStore();
server.listen(port, "127.0.0.1", () => {
  console.log(`[local-interactions] listening on http://127.0.0.1:${port}`);
  console.log(`[local-interactions] data file: ${dataFile}`);
});
