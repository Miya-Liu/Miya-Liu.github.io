import fs from "fs";
import path from "path";

const root = path.resolve("notion_sources/agent-workflow-image.html");
let body = fs.readFileSync(root, "utf8").trim();

if (body.includes("<!DOCTYPE")) {
  console.log("Already a full HTML document; skipping.");
  process.exit(0);
}

const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent workflow — sequence diagram</title>
<style>
html, body { margin: 0; padding: 0; background: #fff; }
body { padding: 12px; box-sizing: border-box; }
svg { display: block; max-width: min(100%, 2137px); height: auto; margin: 0 auto; }
</style>
</head>
<body>
${body}
</body>
</html>
`;

fs.writeFileSync(root, doc);
console.log("Wrapped agent-workflow-image.html as a full HTML page.");
