"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => CosmosPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/settings.ts
var import_obsidian3 = require("obsidian");

// src/sync.ts
var import_obsidian2 = require("obsidian");

// src/db.ts
var import_obsidian = require("obsidian");
var SUPABASE_URL = "https://gzhdsgkjwxjuelsvksde.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aGRzZ2tqd3hqdWVsc3Zrc2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxNjAzNzYsImV4cCI6MjA4OTczNjM3Nn0.D1B9zbnAynYDkydGVHMSuEP-rzwHoDh5812YLUrWizg";
var REST_URL = `${SUPABASE_URL}/rest/v1`;
function baseHeaders() {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };
}
function parseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
function errorFrom(status, body) {
  if (body && typeof body === "object") {
    const { message } = body;
    if (typeof message === "string" && message) return { message };
  }
  if (typeof body === "string" && body) return { message: body };
  return { message: `HTTP ${status}` };
}
function headerValue(headers, name) {
  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) return headers[key];
  }
  return void 0;
}
function totalFromContentRange(value) {
  if (!value) return null;
  const total = value.split("/")[1];
  if (!total || total === "*") return null;
  const parsed = Number(total);
  return Number.isFinite(parsed) ? parsed : null;
}
async function send(url, method, extraHeaders, body) {
  try {
    const res = await (0, import_obsidian.requestUrl)({
      url,
      method,
      headers: { ...baseHeaders(), ...extraHeaders },
      body: body === void 0 ? void 0 : JSON.stringify(body),
      throw: false
    });
    const parsed = parseBody(res.text);
    if (res.status < 200 || res.status >= 300) {
      return { data: null, error: errorFrom(res.status, parsed), headers: res.headers };
    }
    return { data: parsed, error: null, headers: res.headers };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { data: null, error: { message }, headers: {} };
  }
}
async function rpc(fn, args, options) {
  const params = new URLSearchParams();
  if (options?.select !== void 0) params.set("select", options.select);
  if (options?.order !== void 0) params.set("order", options.order);
  if (options?.limit !== void 0) params.set("limit", String(options.limit));
  if (options?.offset !== void 0) params.set("offset", String(options.offset));
  const query = params.toString();
  const url = query ? `${REST_URL}/rpc/${fn}?${query}` : `${REST_URL}/rpc/${fn}`;
  const res = await send(url, "POST", void 0, args);
  return { data: res.data, error: res.error };
}
async function selectMaybeSingle(table, columns, filters) {
  const params = new URLSearchParams({ ...filters, select: columns, limit: "1" });
  const res = await send(`${REST_URL}/${table}?${params.toString()}`, "GET");
  if (res.error) return { data: null, error: res.error };
  const rows = Array.isArray(res.data) ? res.data : [];
  return { data: rows.length > 0 ? rows[0] : null, error: null };
}
async function count(table, filters) {
  const params = new URLSearchParams({ ...filters, select: "id" });
  const res = await send(`${REST_URL}/${table}?${params.toString()}`, "GET", {
    Prefer: "count=exact",
    "Range-Unit": "items",
    Range: "0-0"
  });
  if (res.error) return { count: null, error: res.error };
  const total = totalFromContentRange(headerValue(res.headers, "content-range"));
  if (total !== null) return { count: total, error: null };
  return { count: Array.isArray(res.data) ? res.data.length : 0, error: null };
}

// src/engine/hash.ts
function fnv1a(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function hashFloat(str) {
  return fnv1a(str) / 4294967295;
}
function hashN(str, n) {
  return Array.from({ length: n }, (_, i) => hashFloat(`${str}:${i}`));
}
function countSyllables(text) {
  const word = text.toLowerCase().replace(/[^a-z]/g, "");
  if (word.length <= 3) return 1;
  let count2 = 0;
  let prevVowel = false;
  for (const ch of word) {
    const isVowel = "aeiouy".includes(ch);
    if (isVowel && !prevVowel) count2++;
    prevVowel = isVowel;
  }
  if (word.endsWith("e") && count2 > 1) count2--;
  return Math.max(1, count2);
}
function contentId(content, date) {
  return fnv1a(`${date}:${content}`).toString(36);
}
async function computeSecureSeed(secret, date, content) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(`0:${secret}:${date}:${content}`)),
    crypto.subtle.digest("SHA-256", enc.encode(`1:${secret}:${date}:${content}`))
  ]);
  const out = new Uint8Array(64);
  out.set(new Uint8Array(a), 0);
  out.set(new Uint8Array(b), 32);
  return out;
}
function seedFloat(seed, byteOffset) {
  const v = (seed[byteOffset] << 24 | seed[byteOffset + 1] << 16 | seed[byteOffset + 2] << 8 | seed[byteOffset + 3]) >>> 0;
  return v / 4294967295;
}
function seedId(seed) {
  let id = "";
  for (let i = 0; i < 8; i++) id += seed[i].toString(16).padStart(2, "0");
  return id;
}
function seedN(seed, offset, n) {
  return Array.from({ length: n }, (_, i) => seedFloat(seed, offset + i * 4));
}

// src/engine/palette.ts
var BODY_COLORS = [
  [0.82, 0.56, 0.61],
  // rose
  [0.52, 0.64, 0.77],
  // frost
  [0.89, 0.75, 0.48],
  // gold
  [0.61, 0.52, 0.71],
  // lilac
  [0.77, 0.58, 0.39],
  // copper
  [0.49, 0.67, 0.53],
  // sage
  [0.83, 0.52, 0.35],
  // ember
  [0.71, 0.64, 0.74],
  // dusty mauve
  [0.85, 0.69, 0.44],
  // amber
  [0.55, 0.72, 0.68]
  // teal
];

// src/engine/orbital.ts
function haikuMassScore(contentStr) {
  const charCount = contentStr.length;
  const words = contentStr.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const uniqueWords = new Set(words).size;
  const structureNudge = Math.min(1, Math.max(0, (charCount - 35) / 45)) * 0.1 + Math.min(1, Math.max(0, (uniqueWords - 8) / 10)) * 0.1;
  return Math.min(1, Math.max(
    0,
    structureNudge + hashFloat(`kind:${contentStr}`) * 0.8
  ));
}
function wordCount(s) {
  return s.trim().split(/\s+/).filter((w) => w.length > 0).length;
}
function genericMassScore(contentStr) {
  const wc = wordCount(contentStr);
  const lengthScore = Math.min(1, Math.log10(wc + 1) / Math.log10(3e3));
  const jitter = hashFloat(`kind:${contentStr}`) * 0.25;
  return Math.min(1, lengthScore * 0.75 + jitter);
}
function haikuMassScoreSecure(contentStr, kindFloat) {
  const charCount = contentStr.length;
  const words = contentStr.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  const uniqueWords = new Set(words).size;
  const structureNudge = Math.min(1, Math.max(0, (charCount - 35) / 45)) * 0.1 + Math.min(1, Math.max(0, (uniqueWords - 8) / 10)) * 0.1;
  return Math.min(1, Math.max(0, structureNudge + kindFloat * 0.8));
}
function genericMassScoreSecure(contentStr, kindFloat) {
  const wc = wordCount(contentStr);
  const lengthScore = Math.min(1, Math.log10(wc + 1) / Math.log10(3e3));
  return Math.min(1, lengthScore * 0.75 + kindFloat * 0.25);
}
function deriveKindSecure(contentType, contentStr, content, kindFloat) {
  if (contentType === "haiku" && content) {
    const score = haikuMassScoreSecure(contentStr, kindFloat);
    if (score > 0.75) return "planet";
    if (score > 0.45) return "moon";
    if (score > 0.2) return "asteroid";
    return "comet";
  }
  const wc = wordCount(contentStr);
  if (wc >= 2e3) return "gasgiant";
  if (wc >= 400) return "planet";
  if (wc >= 80) return "moon";
  if (wc >= 20) return "asteroid";
  switch (contentType) {
    case "milestone":
      return "planet";
    case "memory":
      return kindFloat > 0.15 ? "planet" : "moon";
    case "place":
      return kindFloat > 0.3 ? "moon" : "asteroid";
    default:
      return kindFloat > 0.5 ? "asteroid" : "comet";
  }
}
function deriveKind(contentType, contentStr, content) {
  if (contentType === "haiku" && content) {
    const score = haikuMassScore(contentStr);
    if (score > 0.75) return "planet";
    if (score > 0.45) return "moon";
    if (score > 0.2) return "asteroid";
    return "comet";
  }
  const wc = wordCount(contentStr);
  if (wc >= 2e3) return "gasgiant";
  if (wc >= 400) return "planet";
  if (wc >= 80) return "moon";
  if (wc >= 20) return "asteroid";
  const h = hashFloat(`kind:${contentStr}`);
  switch (contentType) {
    case "milestone":
      return "planet";
    case "memory":
      return h > 0.15 ? "planet" : "moon";
    case "place":
      return h > 0.3 ? "moon" : "asteroid";
    default:
      return h > 0.5 ? "asteroid" : "comet";
  }
}
var KIND_SIZE = {
  gasgiant: [0.3, 0.55],
  planet: [0.12, 0.28],
  moon: [0.03, 0.08],
  asteroid: [0.02, 0.05],
  comet: [0.02, 0.07]
};
var KIND_MASS = {
  gasgiant: [3, 8],
  planet: [0.5, 3],
  moon: [0.05, 0.4],
  asteroid: [1e-3, 0.04],
  comet: [1e-3, 0.03]
};
var KIND_ECC = {
  gasgiant: { base: 0.01, range: 0.05 },
  planet: { base: 0.01, range: 0.07 },
  moon: { base: 0.01, range: 0.04 },
  asteroid: { base: 0.1, range: 0.2 },
  comet: { base: 0.6, range: 0.32 }
};
var KIND_INC = {
  gasgiant: { base: 0.01, range: 0.03 },
  planet: { base: 0.01, range: 0.04 },
  moon: { base: 0.05, range: 0.15 },
  asteroid: { base: 0.1, range: 0.2 },
  comet: { base: 0.2, range: 1 }
};
function contentToString(content, contentType) {
  switch (contentType) {
    case "haiku": {
      const c = content;
      return `${c.line1}
${c.line2}
${c.line3}`;
    }
    case "memory": {
      const c = content;
      return `${c.title}
${c.description}`;
    }
    case "place": {
      const c = content;
      return `${c.name}:${c.lat ?? 0}:${c.lng ?? 0}`;
    }
    case "note": {
      return content.text;
    }
    case "milestone": {
      return content.title;
    }
    default:
      return JSON.stringify(content);
  }
}
function orbitalRadius(bodyIndex, totalBodies) {
  const innerEdge = 1.2;
  const n = Math.max(totalBodies ?? 50, 10);
  const spread = Math.max(2, Math.min(2.8, 80 / (Math.sqrt(n) + 4)));
  const jitter = 0.3;
  return innerEdge + Math.sqrt(bodyIndex) * spread + Math.sin(bodyIndex * 2.39996) * jitter;
}
function generateOrbital(contentType, content, date, bodyIndex, secureSeed, totalBodies) {
  const contentStr = contentToString(content, contentType);
  let h;
  let kindFloat;
  let colorIdx;
  let entryId;
  if (secureSeed) {
    entryId = seedId(secureSeed);
    kindFloat = seedFloat(secureSeed, 8);
    colorIdx = Math.floor(seedFloat(secureSeed, 12) * BODY_COLORS.length);
    h = seedN(secureSeed, 16, 12);
  } else {
    const seed = `body:${date}:${contentStr}`;
    h = hashN(seed, 12);
    kindFloat = hashFloat(`kind:${contentStr}`);
    colorIdx = fnv1a(`color:${contentStr}`) % BODY_COLORS.length;
    entryId = contentId(contentStr, date);
  }
  const kind = secureSeed ? deriveKindSecure(contentType, contentStr, content, kindFloat) : deriveKind(contentType, contentStr, content);
  const mScore = secureSeed ? contentType === "haiku" ? haikuMassScoreSecure(contentStr, kindFloat) : genericMassScoreSecure(contentStr, kindFloat) : contentType === "haiku" ? haikuMassScore(contentStr) : genericMassScore(contentStr);
  const semiMajorAxis = orbitalRadius(bodyIndex, totalBodies);
  const ecc = KIND_ECC[kind];
  const eccentricity = Math.min(0.92, ecc.base + h[1] * ecc.range);
  const inc = KIND_INC[kind];
  const inclination = inc.base + h[2] * inc.range;
  const longitudeOfAscending = h[3] * Math.PI * 2;
  const argumentOfPeriapsis = h[4] * Math.PI * 2;
  const meanAnomalyAtEpoch = h[5] * Math.PI * 2;
  const period = Math.sqrt(Math.pow(semiMajorAxis, 3)) * 2;
  const [massMin, massMax] = KIND_MASS[kind];
  const mass = massMin + mScore * (massMax - massMin);
  const [sizeMin, sizeMax] = KIND_SIZE[kind];
  const bodyRadius = sizeMin + h[6] * (sizeMax - sizeMin);
  const bodyColor = BODY_COLORS[colorIdx % BODY_COLORS.length];
  const hasRings = kind === "gasgiant" && h[7] > 0.4 || kind === "planet" && bodyRadius > 0.18 && h[7] > 0.7;
  const ringColorIdx = (colorIdx + 3) % BODY_COLORS.length;
  let finalEcc = eccentricity;
  if (!secureSeed && contentType === "haiku") {
    const haiku = content;
    const s1 = countSyllables(haiku.line1);
    const s2 = countSyllables(haiku.line2);
    const s3 = countSyllables(haiku.line3);
    const balance = Math.abs(s1 - 5) + Math.abs(s2 - 7) + Math.abs(s3 - 5);
    finalEcc = Math.min(0.92, eccentricity + balance * 0.03);
  }
  return {
    kind,
    id: entryId,
    orbital: {
      semiMajorAxis,
      eccentricity: finalEcc,
      inclination,
      longitudeOfAscending,
      argumentOfPeriapsis,
      meanAnomalyAtEpoch,
      period,
      mass,
      bodyRadius,
      bodyColor,
      hasRings,
      ringColor: hasRings ? BODY_COLORS[ringColorIdx] : void 0
    }
  };
}

// src/sync.ts
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}
function randomHash() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
function emptyContent(type) {
  switch (type) {
    case "haiku":
      return { line1: "", line2: "", line3: "" };
    case "memory":
      return { title: "", description: "" };
    case "place":
      return { name: "" };
    case "milestone":
      return { title: "" };
    case "note":
    default:
      return { text: "" };
  }
}
function dateFromFilename(filename) {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
function formatDate(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}
function detectHaiku(body) {
  const lines = body.trim().split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length !== 3) return null;
  if (lines.some((l) => l.length > 40)) return null;
  return { line1: lines[0], line2: lines[1], line3: lines[2] };
}
function extractFrontmatter(raw) {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) return { frontmatter: {}, body: raw };
  try {
    const parsed = (0, import_obsidian2.parseYaml)(fmMatch[1]);
    return { frontmatter: parsed ?? {}, body: fmMatch[2] };
  } catch {
    return { frontmatter: {}, body: fmMatch[2] };
  }
}
function parseFile(file, raw) {
  const { frontmatter, body } = extractFrontmatter(raw);
  let date = null;
  if (frontmatter.date && typeof frontmatter.date === "string") {
    date = frontmatter.date;
  }
  if (!date) date = dateFromFilename(file.name);
  if (!date) {
    const ctime = file.stat.ctime;
    const mtime = file.stat.mtime;
    date = formatDate(ctime > 0 ? ctime : mtime);
  }
  let contentType = "note";
  let content;
  const fmType = typeof frontmatter.type === "string" ? frontmatter.type.toLowerCase() : null;
  const validTypes = ["haiku", "memory", "place", "note", "milestone"];
  if (fmType && validTypes.includes(fmType)) {
    contentType = fmType;
  }
  if (contentType === "haiku") {
    const h = detectHaiku(body);
    content = h ?? { line1: body.trim(), line2: "", line3: "" };
  } else if (contentType === "note") {
    const h = detectHaiku(body);
    if (h) {
      contentType = "haiku";
      content = h;
    } else {
      content = { text: body.trim() };
    }
  } else if (contentType === "memory") {
    content = {
      title: typeof frontmatter.title === "string" ? frontmatter.title : file.basename,
      description: body.trim()
    };
  } else if (contentType === "place") {
    content = {
      name: typeof frontmatter.name === "string" ? frontmatter.name : file.basename,
      lat: typeof frontmatter.lat === "number" ? frontmatter.lat : void 0,
      lng: typeof frontmatter.lng === "number" ? frontmatter.lng : void 0
    };
  } else {
    content = {
      title: typeof frontmatter.title === "string" ? frontmatter.title : body.trim().split("\n")[0]
    };
  }
  return { date, contentType, content, filePath: file.path };
}
var EXCLUDED_DIRS = /* @__PURE__ */ new Set([
  ".trash",
  ".git",
  "node_modules",
  "attachments",
  "assets",
  "media"
]);
function isExcluded(path, configDir) {
  const parts = path.split("/");
  return parts.some((p) => p === configDir || EXCLUDED_DIRS.has(p) || p.startsWith("."));
}
async function computeOwnerHash(secret) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
async function syncVault(vault, settings) {
  if (!settings.systemName) {
    new import_obsidian2.Notice("Cosmos: please set a system name in settings.");
    return;
  }
  const notice = new import_obsidian2.Notice("Cosmos: starting sync...", 0);
  try {
    if (!settings.passphraseHash) {
      settings.passphraseHash = randomHash();
    }
    if (!settings.systemSecret) {
      settings.systemSecret = randomHash();
    }
    const slug = settings.systemSlug || slugify(settings.systemName);
    const { data: existing } = await selectMaybeSingle(
      "solar_systems",
      "id",
      { slug: `eq.${slug}` }
    );
    let systemId;
    if (existing) {
      systemId = existing.id;
    } else {
      notice.setMessage("Cosmos: creating solar system...");
      const ownerHash2 = await computeOwnerHash(settings.systemSecret);
      const { data: newId, error } = await rpc("create_solar_system", {
        p_name: settings.systemName,
        p_slug: slug,
        p_passphrase_hash: settings.passphraseHash,
        p_owner_secret_hash: ownerHash2
      });
      if (error || !newId) {
        throw new Error(`Failed to create system: ${error?.message || "unknown error"}`);
      }
      systemId = newId;
    }
    if (!settings.systemSlug) {
      settings.systemSlug = slug;
    }
    const ownerHash = await computeOwnerHash(settings.systemSecret);
    let starName = settings.starName;
    if (!starName) {
      const { count: count2 } = await count("stars", { system_id: `eq.${systemId}` });
      starName = `Sol ${(count2 ?? 0) + 1}`;
      settings.starName = starName;
    }
    const { data: starIdData, error: starErr } = await rpc("upsert_star", {
      p_system_id: systemId,
      p_name: starName,
      p_position: 0,
      p_owner_secret_hash: ownerHash
    });
    if (starErr || !starIdData) {
      throw new Error(`Failed to upsert star: ${starErr?.message || "unknown error"}`);
    }
    const starId = starIdData;
    const existingEntryIds = /* @__PURE__ */ new Set();
    const PAGE_SIZE = 1e3;
    let offset = 0;
    while (true) {
      const { data, error: entriesErr } = await rpc(
        "get_entries_public",
        { p_system_id: systemId },
        { select: "id,orbital_meta", order: "id", limit: PAGE_SIZE, offset }
      );
      if (entriesErr) {
        throw new Error(`Failed to load existing entries: ${entriesErr.message}`);
      }
      const page = data ?? [];
      for (const e of page) {
        if (e.orbital_meta?.id) existingEntryIds.add(e.orbital_meta.id);
      }
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    notice.setMessage("Cosmos: reading vault...");
    const configDir = vault.configDir;
    const mdFiles = vault.getMarkdownFiles().filter((f) => {
      if (isExcluded(f.path, configDir)) return false;
      if (settings.syncFolder) {
        return f.path.startsWith(settings.syncFolder + "/") || f.path === settings.syncFolder;
      }
      return true;
    });
    const parsed = [];
    for (const file of mdFiles) {
      const raw = await vault.cachedRead(file);
      parsed.push(parseFile(file, raw));
    }
    parsed.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    notice.setMessage(`Cosmos: computing orbits for ${parsed.length} files...`);
    const BATCH_SIZE = 200;
    const enriched = [];
    for (let batchStart = 0; batchStart < parsed.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, parsed.length);
      const batch = parsed.slice(batchStart, batchEnd);
      const seeds = await Promise.all(
        batch.map((entry) => computeSecureSeed(
          settings.systemSecret,
          entry.date,
          contentToString(entry.content, entry.contentType)
        ))
      );
      for (let j = 0; j < batch.length; j++) {
        const idx = batchStart + j;
        const meta = generateOrbital(batch[j].contentType, batch[j].content, batch[j].date, idx, seeds[j], parsed.length);
        enriched.push({ entry: batch[j], meta });
      }
      if (batchStart > 0 && batchStart % 2e3 === 0) {
        notice.setMessage(`Cosmos: computing orbits... ${batchStart}/${parsed.length}`);
      }
    }
    const newEntries = enriched.filter(({ meta }) => !existingEntryIds.has(meta.id));
    const skipped = enriched.length - newEntries.length;
    if (newEntries.length === 0) {
      notice.hide();
      const frag2 = createFragment();
      frag2.appendText(`Cosmos: up to date (${skipped} entries synced). `);
      const link2 = createEl("a", { href: `${COSMOS_BASE_URL}/s/${slug}`, text: "View your galaxy \u2192", cls: "cosmos-notice-link" });
      link2.addEventListener("click", (e) => {
        e.preventDefault();
        window.open(link2.href, "_blank");
      });
      frag2.appendChild(link2);
      new import_obsidian2.Notice(frag2, 6e3);
      return;
    }
    notice.setMessage(`Cosmos: syncing ${newEntries.length} new entries...`);
    const INSERT_BATCH = 20;
    let inserted = 0;
    for (let i = 0; i < newEntries.length; i += INSERT_BATCH) {
      const batch = newEntries.slice(i, i + INSERT_BATCH);
      const results = await Promise.all(
        batch.map(({ entry, meta }) => {
          const storedContent = emptyContent(entry.contentType);
          return rpc("add_entry", {
            p_system_id: systemId,
            p_star_id: starId,
            p_content_type: entry.contentType,
            p_content: storedContent,
            p_date: entry.date,
            p_orbital_meta: meta,
            p_owner_secret_hash: ownerHash
          });
        })
      );
      for (let j = 0; j < results.length; j++) {
        if (results[j].error) {
          throw new Error(`add_entry failed for ${batch[j].entry.filePath}: ${results[j].error.message}`);
        }
      }
      inserted += batch.length;
      notice.setMessage(`Cosmos: synced ${inserted}/${newEntries.length}...`);
    }
    notice.hide();
    const frag = createFragment();
    frag.appendText(`Cosmos: synced ${inserted} new entries (${skipped} already synced). `);
    const link = createEl("a", { href: `${COSMOS_BASE_URL}/s/${slug}`, text: "View your galaxy \u2192", cls: "cosmos-notice-link" });
    link.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(link.href, "_blank");
    });
    frag.appendChild(link);
    new import_obsidian2.Notice(frag, 8e3);
  } catch (err) {
    notice.hide();
    const msg = err instanceof Error ? err.message : String(err);
    new import_obsidian2.Notice(`Cosmos sync failed: ${msg}`, 1e4);
    console.error("Cosmos sync error:", err);
  }
}

// src/settings.ts
var DEFAULT_SETTINGS = {
  systemName: "",
  syncFolder: "",
  starName: "",
  passphraseHash: "",
  systemSecret: "",
  systemSlug: ""
};
var COSMOS_BASE_URL = "https://cosmos.supermagicapps.com";
var CosmosSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("p", {
      text: "Only orbital metadata leaves your machine. Content is never sent.",
      cls: "setting-item-description"
    });
    const slugLocked = !!this.plugin.settings.systemSlug;
    const systemNameSetting = new import_obsidian3.Setting(containerEl).setName("System name");
    if (slugLocked) {
      systemNameSetting.setDesc(`Locked to slug: ${this.plugin.settings.systemSlug}`).addText((text) => text.setValue(this.plugin.settings.systemName).setDisabled(true));
    } else {
      systemNameSetting.setDesc("The name of your solar system").addText((text) => text.setPlaceholder("My vault").setValue(this.plugin.settings.systemName).onChange(async (value) => {
        this.plugin.settings.systemName = value;
        await this.plugin.saveSettings();
      }));
    }
    if (slugLocked) {
      const linkEl = containerEl.createDiv({ cls: "cosmos-galaxy-link" });
      linkEl.createEl("a", {
        text: `View your galaxy \u2192`,
        href: `${COSMOS_BASE_URL}/s/${this.plugin.settings.systemSlug}`
      });
      new import_obsidian3.Setting(containerEl).setName("Delete system").setDesc("Permanently delete this solar system").addButton((btn) => btn.setButtonText("Delete").setWarning().onClick(() => {
        new ConfirmDeleteModal(this.app, this.plugin, () => this.display()).open();
      }));
    }
    new import_obsidian3.Setting(containerEl).setName("Star name").setDesc("Name of the star (leave blank to auto-assign)").addText((text) => text.setPlaceholder("Sol 1").setValue(this.plugin.settings.starName).onChange(async (value) => {
      this.plugin.settings.starName = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(containerEl).setName("Sync folder").setDesc("Folder to sync (leave blank for entire vault)").addText((text) => text.setPlaceholder("").setValue(this.plugin.settings.syncFolder).onChange(async (value) => {
      this.plugin.settings.syncFolder = value;
      await this.plugin.saveSettings();
    }));
  }
};
var ConfirmDeleteModal = class extends import_obsidian3.Modal {
  constructor(app, plugin, onDeleted) {
    super(app);
    this.plugin = plugin;
    this.onDeleted = onDeleted;
  }
  onOpen() {
    const { contentEl } = this;
    const slug = this.plugin.settings.systemSlug;
    contentEl.createEl("h3", { text: "Delete system" });
    contentEl.createEl("p", {
      text: `This will permanently delete "${slug}" and all its stars and entries. This cannot be undone.`
    });
    const btnRow = contentEl.createDiv({ cls: "modal-button-container" });
    btnRow.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    const deleteBtn = btnRow.createEl("button", { text: "Delete", cls: "mod-warning" });
    deleteBtn.addEventListener("click", () => {
      void this.handleDelete(slug, deleteBtn).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        new import_obsidian3.Notice(`Delete failed: ${msg}`, 8e3);
      });
    });
  }
  async handleDelete(slug, deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Deleting...";
    const ownerHash = await computeOwnerHash(this.plugin.settings.systemSecret);
    const { data, error } = await rpc("delete_system", {
      p_slug: slug,
      p_owner_secret_hash: ownerHash
    });
    if (error) {
      new import_obsidian3.Notice(`Delete failed: ${error.message}`, 8e3);
    } else if (data === true) {
      this.plugin.settings.systemSlug = "";
      this.plugin.settings.starName = "";
      this.plugin.settings.passphraseHash = "";
      this.plugin.settings.systemSecret = "";
      await this.plugin.saveSettings();
      new import_obsidian3.Notice(`System "${slug}" deleted. You can create a new one by syncing.`, 5e3);
      this.onDeleted();
    } else {
      new import_obsidian3.Notice("Delete failed: owner secret did not match.", 8e3);
    }
    this.close();
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/main.ts
var CosmosPlugin = class extends import_obsidian4.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new CosmosSettingTab(this.app, this));
    this.addCommand({
      id: "sync-vault",
      name: "Sync vault",
      callback: async () => {
        await syncVault(this.app.vault, this.settings);
        await this.saveSettings();
      }
    });
    this.addCommand({
      id: "delete-system",
      name: "Delete system",
      callback: () => {
        new DeleteSystemModal(this.app, this).open();
      }
    });
    this.addRibbonIcon("orbit", "Sync vault", async () => {
      await syncVault(this.app.vault, this.settings);
      await this.saveSettings();
    });
  }
  onunload() {
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var DeleteSystemModal = class extends import_obsidian4.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    const { contentEl } = this;
    const slug = this.plugin.settings.systemSlug;
    if (!slug) {
      contentEl.createEl("p", { text: "No system has been synced yet. Nothing to delete." });
      return;
    }
    new import_obsidian4.Setting(contentEl).setName("Delete system").setHeading();
    contentEl.createEl("p", {
      text: `This will permanently delete the solar system "${slug}" and all its stars and entries. This cannot be undone.`
    });
    const btnRow = contentEl.createDiv({ cls: "modal-button-container" });
    btnRow.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());
    const deleteBtn = btnRow.createEl("button", { text: "Delete", cls: "mod-warning" });
    deleteBtn.addEventListener("click", () => {
      void this.handleDelete(slug, deleteBtn).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        new import_obsidian4.Notice(`Delete failed: ${msg}`, 8e3);
      });
    });
  }
  async handleDelete(slug, deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.textContent = "Deleting...";
    const ownerHash = await computeOwnerHash(this.plugin.settings.systemSecret);
    const { data, error } = await rpc("delete_system", {
      p_slug: slug,
      p_owner_secret_hash: ownerHash
    });
    if (error) {
      new import_obsidian4.Notice(`Delete failed: ${error.message}`, 8e3);
    } else if (data === true) {
      this.plugin.settings.systemSlug = "";
      this.plugin.settings.starName = "";
      this.plugin.settings.passphraseHash = "";
      this.plugin.settings.systemSecret = "";
      await this.plugin.saveSettings();
      new import_obsidian4.Notice(`System "${slug}" deleted. You can create a new one by syncing.`, 5e3);
    } else {
      new import_obsidian4.Notice("Delete failed: owner secret did not match.", 8e3);
    }
    this.close();
  }
  onClose() {
    this.contentEl.empty();
  }
};
