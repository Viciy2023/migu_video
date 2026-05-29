import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_OUTPUT = "fnos/onetv_api_hometv.m3u";

const REGION_GROUPS = new Map([
  ["广东地区", "广东频道"],
  ["浙江地区", "浙江频道"],
  ["江苏地区", "江苏频道"],
  ["黑龙江地区", "黑龙江频道"],
  ["江西地区", "江西频道"],
  ["陕西地区", "陕西频道"],
]);

const GROUP_ORDER = [
  "🕘️更新时间",
  "公众号【壹来了】",
  "央视频道",
  "卫视频道",
  "广东频道",
  "浙江频道",
  "江苏频道",
  "黑龙江频道",
  "江西频道",
  "陕西频道",
  "其他",
  "体育昨天",
  "体育今天",
  "体育明天",
];

const LOCAL_GROUPS = new Set([
  "🕘️更新时间",
  "公众号【壹来了】",
  "央视频道",
  "卫视频道",
  "其他",
  "体育昨天",
  "体育今天",
  "体育明天",
]);

const REMOTE_BASE_GROUPS = new Set([
  "🕘️更新时间",
  "公众号【壹来了】",
  "央视频道",
  "卫视频道",
  "超清频道",
]);

const GROUP_ALIASES = new Map([
  ["央视", "央视频道"],
  ["央视台", "央视频道"],
  ["卫视", "卫视频道"],
]);

const CORE_REMOTE_KEYWORDS = [
  "douyincdn",
  "miguvideo",
  "cftest5",
  "mgtv",
  "cztv.com/live",
];

const REGIONAL_REMOTE_KEYWORDS = [
  ...CORE_REMOTE_KEYWORDS,
  "cztvcloud.com",
  "nbs.cn",
  "thmz.com",
  "jstv.com",
  "hljtv.com",
  "hrbtv.net",
  "quklive.com",
  "snrtv.com",
  "hebyun.com.cn",
  "migucloud.com",
];

function extractGroup(extinf) {
  const match = extinf.match(/group-title="([^"]+)"/);
  return match ? match[1] : "";
}

function entryName(extinf) {
  const commaIndex = extinf.lastIndexOf(",");
  return commaIndex === -1 ? "" : extinf.slice(commaIndex + 1).trim();
}

function replaceGroup(extinf, targetGroup) {
  if (extinf.includes('group-title="')) {
    return extinf.replace(/group-title="[^"]*"/, `group-title="${targetGroup}"`);
  }
  return extinf.replace("#EXTINF:-1", `#EXTINF:-1 group-title="${targetGroup}"`);
}

function replaceName(extinf, targetName) {
  const commaIndex = extinf.lastIndexOf(",");
  if (commaIndex === -1) {
    return `${extinf},${targetName}`;
  }
  return `${extinf.slice(0, commaIndex + 1)}${targetName}`;
}

export function parseM3u(text, source) {
  const lines = String(text).split(/\r?\n/);
  const header = lines.find((line) => line.startsWith("#EXTM3U")) || "#EXTM3U";
  const entries = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith("#EXTINF")) {
      continue;
    }

    const url = lines[index + 1]?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      continue;
    }

    entries.push({
      extinf: line,
      url,
      group: extractGroup(line),
      name: entryName(line),
      source,
      sequence: entries.length,
    });
    index += 1;
  }

  return { header, entries };
}

export function normalizeChannelName(name) {
  const normalized = String(name).trim();
  if (/超清|高清|4K|8K/i.test(normalized)) {
    return normalized;
  }
  const cctvMatch = normalized.match(/^CCTV(\d+\+?)/i);
  if (cctvMatch) {
    return `CCTV${cctvMatch[1]}`;
  }
  return normalized.replace(/4K$/, "").trim();
}

export function mapGroup(group, name) {
  if (GROUP_ALIASES.has(group)) {
    return GROUP_ALIASES.get(group);
  }

  if (REGION_GROUPS.has(group)) {
    return REGION_GROUPS.get(group);
  }

  if (group === "超清频道") {
    return normalizeChannelName(name).startsWith("CCTV") ? "央视频道" : "卫视频道";
  }

  return group;
}

export function isRemoteEntryAllowed(entry) {
  const targetGroup = mapGroup(entry.group, entry.name);
  const url = entry.url.toLowerCase();

  if (targetGroup === "央视频道" || targetGroup === "卫视频道") {
    return CORE_REMOTE_KEYWORDS.some((keyword) => url.includes(keyword));
  }

  if ([...REGION_GROUPS.values()].includes(targetGroup)) {
    return REGIONAL_REMOTE_KEYWORDS.some((keyword) => url.includes(keyword));
  }

  return false;
}

function normalizeEntry(entry) {
  const group = mapGroup(entry.group, entry.name);
  const name = normalizeChannelName(entry.name);
  return {
    ...entry,
    extinf: replaceName(replaceGroup(entry.extinf, group), name),
    group,
    name,
    priority: entry.source === "local" ? 0 : 1,
  };
}

function shouldKeepLocalEntry(entry) {
  const group = mapGroup(entry.group, entry.name);
  return LOCAL_GROUPS.has(group) || group.startsWith("体育");
}

function shouldKeepRemoteEntry(entry) {
  const group = mapGroup(entry.group, entry.name);
  return REMOTE_BASE_GROUPS.has(group) || REGION_GROUPS.has(entry.group) || [...REGION_GROUPS.values()].includes(group);
}

function entryDedupKey(entry) {
  return `${entry.name}\n${entry.url}`;
}

export function mergePlaylists(localText, remoteText) {
  const { header, entries: localEntries } = parseM3u(localText, "local");
  const { entries: remoteEntries } = parseM3u(remoteText, "remote");
  const merged = [];
  const seenEntries = new Set();

  for (const entry of localEntries) {
    if (!shouldKeepLocalEntry(entry)) {
      continue;
    }
    const normalizedEntry = normalizeEntry(entry);
    const dedupKey = entryDedupKey(normalizedEntry);
    if (seenEntries.has(dedupKey)) {
      continue;
    }
    seenEntries.add(dedupKey);
    merged.push(normalizedEntry);
  }

  for (const entry of remoteEntries) {
    if (!shouldKeepRemoteEntry(entry) || !isRemoteEntryAllowed(entry)) {
      continue;
    }
    const normalizedEntry = normalizeEntry(entry);
    const dedupKey = entryDedupKey(normalizedEntry);
    if (seenEntries.has(dedupKey)) {
      continue;
    }
    seenEntries.add(dedupKey);
    merged.push(normalizedEntry);
  }

  const groupRank = new Map(GROUP_ORDER.map((group, index) => [group, index]));
  merged.sort((left, right) => {
    const groupDiff = (groupRank.get(left.group) ?? GROUP_ORDER.length) - (groupRank.get(right.group) ?? GROUP_ORDER.length);
    if (groupDiff !== 0) return groupDiff;
    const nameDiff = left.name.localeCompare(right.name, "zh-Hans-CN", { numeric: true });
    if (nameDiff !== 0) return nameDiff;
    const priorityDiff = left.priority - right.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return left.sequence - right.sequence;
  });

  const output = [header];
  for (const entry of merged) {
    output.push(entry.extinf, entry.url);
  }
  return `${output.join("\n")}\n`;
}

async function fetchPlaylist(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetch failed ${response.status}: ${url}`);
  }
  const text = await response.text();
  if (!text.startsWith("#EXTM3U")) {
    throw new Error(`playlist response does not start with #EXTM3U: ${url}`);
  }
  return text;
}

export function resolveRemoteZbproUrl(env = process.env) {
  if (env.REMOTE_ZBPRO_URL) {
    return env.REMOTE_ZBPRO_URL;
  }
  if (!env.FNOS_MIGU_URL) {
    return "";
  }
  const url = new URL(env.FNOS_MIGU_URL);
  const parts = url.pathname.split("/").filter(Boolean);
  const interfaceIndex = parts.lastIndexOf("interface.txt");
  if (interfaceIndex !== -1) {
    parts.splice(interfaceIndex, 1, "zbpro", "interface.txt");
  } else {
    parts.push("zbpro", "interface.txt");
  }
  url.pathname = `/${parts.join("/")}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function atomicWrite(filePath, content) {
  const dir = path.dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  writeFileSync(tempPath, content, "utf8");
  renameSync(tempPath, filePath);
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function maybePush(outputPath) {
  git(["add", outputPath]);
  const diff = git(["diff", "--cached", "--name-only", "--", outputPath]).trim();
  if (!diff) {
    console.log("M3U unchanged; git push skipped");
    return;
  }
  git(["commit", "-m", "Update FNOS OneTV playlist"]);
  git(["push"]);
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "migu-video-fnos-merge",
  };
}

function requireGithubEnv(env) {
  const required = ["GITHUB_TOKEN", "GITHUB_OWNER", "GITHUB_REPO", "GITHUB_TARGET_PATH"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`GitHub API upload missing environment variables: ${missing.join(", ")}`);
  }
}

export async function uploadToGitHubViaApi(content, env = process.env, fetchImpl = fetch) {
  requireGithubEnv(env);
  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "main";
  const targetPath = env.GITHUB_TARGET_PATH;
  const message = env.GITHUB_COMMIT_MESSAGE || "Update FNOS OneTV playlist";
  const encodedPath = encodeURIComponent(targetPath);
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
  const headers = githubHeaders(env.GITHUB_TOKEN);
  let sha;

  const getResponse = await fetchImpl(`${baseUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  if (getResponse.status === 200) {
    const fileInfo = await getResponse.json();
    sha = fileInfo.sha;
  } else if (getResponse.status !== 404) {
    const body = await getResponse.text();
    throw new Error(`GitHub API failed to read ${targetPath}: HTTP ${getResponse.status} ${body}`);
  }

  const payload = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch,
  };
  if (sha) {
    payload.sha = sha;
  }

  const putResponse = await fetchImpl(baseUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  if (!putResponse.ok) {
    const body = await putResponse.text();
    throw new Error(`GitHub API failed to upload ${targetPath}: HTTP ${putResponse.status} ${body}`);
  }

  const result = await putResponse.json();
  return result.commit?.sha || "";
}

function requireSupabaseEnv(env) {
  const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Supabase upload missing environment variables: ${missing.join(", ")}`);
  }
}

export async function uploadToSupabaseStorage(content, env = process.env, fetchImpl = fetch) {
  requireSupabaseEnv(env);
  const supabaseUrl = env.SUPABASE_URL.replace(/\/+$/, "");
  const bucket = env.SUPABASE_BUCKET || "iptv-sources";
  const objectName = env.SUPABASE_OBJECT_NAME || "onetv_api_hometv.m3u";
  const objectPath = encodeURIComponent(objectName).replace(/%2F/g, "/");
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;

  const response = await fetchImpl(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
      apikey: env.SUPABASE_ANON_KEY,
      "Content-Type": "audio/x-mpegurl; charset=utf-8",
      "x-upsert": "true",
    },
    body: content,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase upload failed: HTTP ${response.status} ${body}`);
  }

  return objectName;
}

export function resultPathMessages(outputPath, env = process.env) {
  const messages = [
    "成果文件已存放在以下路径:",
    `本地M3U: ${outputPath}`,
  ];
  if (env.ONETV_PUBLIC_URL) {
    messages.push(`HTTP访问地址: ${env.ONETV_PUBLIC_URL}`);
  }
  if (env.SUPABASE_UPLOAD === "1") {
    const bucket = env.SUPABASE_BUCKET || "iptv-sources";
    const objectName = env.SUPABASE_OBJECT_NAME || "onetv_api_hometv.m3u";
    messages.push(`Supabase对象: ${bucket}/${objectName}`);
  }
  return messages;
}

export async function runCli(env = process.env) {
  const localUrl = env.FNOS_MIGU_URL;
  const remoteUrl = resolveRemoteZbproUrl(env);
  const outputPath = env.ONETV_OUTPUT || DEFAULT_OUTPUT;

  if (!localUrl) {
    throw new Error("FNOS_MIGU_URL is required, for example http://192.168.1.10:1234/interface.txt");
  }
  if (/https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(localUrl)) {
    throw new Error("FNOS_MIGU_URL must not use localhost or 127.0.0.1 because TV clients cannot play those URLs");
  }

  console.log(`Fetching local playlist: ${localUrl}`);
  const localText = await fetchPlaylist(localUrl);
  console.log(`Fetching remote playlist: ${remoteUrl}`);
  const remoteText = await fetchPlaylist(remoteUrl);
  const merged = mergePlaylists(localText, remoteText);

  if (!merged.includes("央视频道") || !merged.includes("卫视频道")) {
    throw new Error("merged playlist is missing required CCTV or satellite groups");
  }

  const previous = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
  if (previous === merged) {
    console.log(`M3U unchanged: ${outputPath}`);
  } else {
    atomicWrite(outputPath, merged);
    console.log(`M3U updated: ${outputPath}`);
  }

  if (env.ONETV_AUTO_PUSH === "1") {
    maybePush(outputPath);
  }

  if (env.GITHUB_API_UPLOAD === "1") {
    const commitSha = await uploadToGitHubViaApi(merged, env);
    console.log(`GitHub API upload completed: ${commitSha}`);
  }

  if (env.SUPABASE_UPLOAD === "1") {
    const objectName = await uploadToSupabaseStorage(merged, env);
    console.log(`Supabase upload completed: ${objectName}`);
  }

  for (const message of resultPathMessages(outputPath, env)) {
    console.log(message);
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

process.on("exit", () => {
  const outputPath = process.env.ONETV_OUTPUT || DEFAULT_OUTPUT;
  const tempPath = path.join(path.dirname(outputPath), `.${path.basename(outputPath)}.${process.pid}.tmp`);
  if (existsSync(tempPath)) {
    rmSync(tempPath, { force: true });
  }
});
