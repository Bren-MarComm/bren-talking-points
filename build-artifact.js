// Bundles the site into one self-contained HTML file for publishing as a Claude artifact.
// Artifacts supply their own <!doctype>/<html>/<head>/<body> wrapper, so this emits only
// the title, styles, markup and scripts.

const fs = require("fs");
const path = require("path");

const root = __dirname;
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

const indexHtml = read("index.html");

const bodyMatch = indexHtml.match(/<body>([\s\S]*)<\/body>/);
if (!bodyMatch) throw new Error("Could not find <body> in index.html");

const markup = bodyMatch[1]
  .replace(/<script src="[^"]*"><\/script>\s*/g, "")
  .trim();

const titleMatch = indexHtml.match(/<title>([^<]*)<\/title>/);
if (!titleMatch) throw new Error("Could not find <title> in index.html");

const scripts = ["js/taxonomy.js", "js/seed-data.js", "js/app.js"]
  .map((f) => "<script>\n" + read(f).trim() + "\n</script>")
  .join("\n");

const out = [
  "<title>" + titleMatch[1] + "</title>",
  "<style>",
  read("css/styles.css").trim(),
  "</style>",
  markup,
  scripts,
  ""
].join("\n");

const outPath = path.join(root, "dist", "bren-talking-points.html");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log("wrote", path.relative(root, outPath), (out.length / 1024).toFixed(1) + " KB");
