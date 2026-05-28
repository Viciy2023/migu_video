const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { gunzipSync } = require("node:zlib");

const KEY = [121, 111, 117, 33, 106, 101, 64, 49, 57, 114, 114, 36, 50, 48, 121, 35];
const IV = [65, 114, 101, 121, 111, 117, 124, 62, 127, 110, 54, 38, 13, 97, 110, 63];

function decryptUrl(baseData) {
  const data = Buffer.from(baseData, "base64");
  const decipher = crypto.createDecipheriv("aes-128-cbc", Buffer.from(KEY), Buffer.from(IV));
  decipher.setAutoPadding(true);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString();
}

async function main() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);
  const resp = await fetch("http://pro.fengcaizb.com/channels/pro.gz", {
    headers: { Referer: "http://pro.fengcaizb.com" },
    signal: controller.signal,
  });

  console.log("status", resp.status, resp.statusText);
  const buffer = Buffer.from(await resp.arrayBuffer());
  clearTimeout(timeout);
  console.log("downloadBytes", buffer.length);
  const result = JSON.parse(gunzipSync(buffer).toString());

  const rows = [];
  const domains = new Map();
  const provinces = new Map();
  let rawUrls = 0;
  let badFormat = 0;
  let adChannels = 0;

  for (const channel of result.data || []) {
    if (channel?.ct) {
      adChannels += 1;
      continue;
    }

    for (const encryptedUrl of channel.urls || []) {
      rawUrls += 1;
      let url = decryptUrl(encryptedUrl);
      if (url.startsWith("sys_http")) {
        url = url.replace("sys_", "");
      }
      if (!url.startsWith("http")) {
        badFormat += 1;
        continue;
      }
      if (url.includes("$")) {
        url = url.split("$")[0];
      }

      const domain = url.split("/")[2] || "";
      const province = channel.province || "";
      const title = (channel.title || "").replace("-", "");
      rows.push({ province, title, domain, url });
      domains.set(domain, (domains.get(domain) || 0) + 1);
      provinces.set(province, (provinces.get(province) || 0) + 1);
    }
  }

  const updateTime = new Date(result.timestamp + 8 * 60 * 60 * 1000);
  console.log("timestamp", result.timestamp, updateTime.toISOString().replace("T", " ").replace(".000Z", ""));
  console.log(
    "rawUrls",
    rawUrls,
    "validUrls",
    rows.length,
    "badFormat",
    badFormat,
    "adChannels",
    adChannels,
    "uniqueDomains",
    domains.size,
    "uniqueTitles",
    new Set(rows.map((row) => row.title)).size,
  );

  console.log("\nTOP_DOMAINS");
  [...domains.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .forEach(([domain, count]) => console.log(`${count}\t${domain}`));

  console.log("\nPROVINCES");
  [...provinces.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([province, count]) => console.log(`${count}\t${province}`));

  console.log("\nSAMPLE_URLS_FIRST_160");
  rows.slice(0, 160).forEach((row, index) => {
    console.log(`${index + 1}\t${row.province}\t${row.title}\t${row.domain}\t${row.url}`);
  });

  const outDir = process.env.OUT_DIR || path.join(process.cwd(), ".tmp");
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, "zbpro-urls.json");
  const tsvPath = path.join(outDir, "zbpro-urls.tsv");
  fs.writeFileSync(jsonPath, JSON.stringify(rows, null, 2));
  fs.writeFileSync(
    tsvPath,
    ["province\ttitle\tdomain\turl", ...rows.map((row) => `${row.province}\t${row.title}\t${row.domain}\t${row.url}`)].join("\n"),
  );
  console.log("\nEXPORTED");
  console.log(jsonPath);
  console.log(tsvPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
