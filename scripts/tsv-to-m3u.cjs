const fs = require("node:fs");
const path = require("node:path");

const inputPath = path.join(process.cwd(), ".tmp", "zbpro-urls.tsv");
const outputPath = path.join(process.cwd(), ".tmp", "zbpro-urls.m3u");
const logoBaseUrl = "https://raw.githubusercontent.com/fanmingming/live/main/tv";

function escapeAttr(value) {
  return String(value || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function normalizeLogoName(title) {
  const normalized = String(title || "")
    .replace(/^CCTV(\d+)\+.*/, "CCTV$1+")
    .replace(/^CCTV(\d+).*/, "CCTV$1")
    .replace(/^CCTV(风云|央视|第一|高尔夫|世界|女性|怀旧|兵器|电视).*/, (match) => match)
    .replaceAll(" ", "");
  return encodeURIComponent(normalized);
}

function normalizeDisplayName(title) {
  const cctvMatch = String(title || "").match(/^CCTV(\d+)(\+)?/);
  if (!cctvMatch) {
    return title;
  }
  return `CCTV-${cctvMatch[1]}${cctvMatch[2] || ""}`;
}

const content = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
const lines = content.split(/\r?\n/).filter(Boolean);
const output = ["#EXTM3U"];

for (const line of lines.slice(1)) {
  const [province, title, _domain, ...urlParts] = line.split("\t");
  const url = urlParts.join("\t").trim();
  if (!province || !title || !url) {
    continue;
  }

  const logoName = normalizeLogoName(title);
  const displayName = normalizeDisplayName(title);
  const logoUrl = `${logoBaseUrl}/${logoName}.png`;
  output.push(
    `#EXTINF:-1 tvg-name="${escapeAttr(title)}" tvg-logo="${escapeAttr(logoUrl)}" group-title="${escapeAttr(province)}",${displayName}`,
  );
  output.push(url);
}

fs.writeFileSync(outputPath, `${output.join("\n")}\n`, "utf8");
console.log(outputPath);
console.log(`entries=${(output.length - 1) / 2}`);
