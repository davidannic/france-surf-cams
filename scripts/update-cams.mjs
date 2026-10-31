// Regenerates ../cams.js from the Viewsurf "surf" and "plage" sections, plus a few
// hand-picked cameras that other sites embed with Viewsurf's public player.
// Usage: node scripts/update-cams.mjs   (Node 18+, no dependencies)

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ORIGIN = "https://www.viewsurf.com";
const SECTIONS = ["surf", "plage"];
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cams.js");
const DELAY_MS = 400;
const LIST_PASSES = 4;
// Refuse to overwrite cams.js if a run finds far fewer cameras (site down, layout change).
const MIN_KEEP_RATIO = 0.7;

// Zones in coastline order (Atlantic south → north, then the rest).
const ZONES = [
  "Pays Basque", "Landes", "Gironde", "Charentes", "Pays de la Loire",
  "Bretagne", "Normandie", "Hauts-de-France", "Languedoc", "Côte d'Azur", "Corse", "La Réunion",
];

// Viewsurf region slug → zone. Aquitaine is split by town below.
const REGION_ZONE = {
  "poitou-charentes": "Charentes",
  "pays-de-la-loire": "Pays de la Loire",
  "bretagne": "Bretagne",
  "basse-normandie": "Normandie",
  "haute-normandie": "Normandie",
  "nord-pas-de-calais": "Hauts-de-France",
  "picardie": "Hauts-de-France",
  "languedoc-roussillon": "Languedoc",
  "provence-alpes-cote-dazur": "Côte d'Azur",
  "corse": "Corse",
  "la-reunion": "La Réunion",
};

const AQUITAINE_TOWNS = {
  "Pays Basque": ["anglet", "biarritz", "bidart", "guethary", "saint-jean-de-luz", "ciboure", "hendaye"],
  "Landes": ["tarnos", "ondres", "labenne", "capbreton", "soorts-hossegor", "hossegor", "seignosse",
             "vieux-boucau", "moliets", "messanges", "lit-et-mixe", "contis", "mimizan", "biscarrosse", "sanguinet"],
  "Gironde": ["la-teste", "arcachon", "andernos-les-bains", "lege-cap-ferret", "lacanau", "carcans", "hourtin",
              "vendays-montalivet", "soulac"],
};

// Slug prefixes (after "france-") of cameras that aren't on the coast.
const EXCLUDE = [
  "ile-de-france-", "aquitaine-bordeaux-", "aquitaine-arjuzanx-", "aquitaine-orx-", "aquitaine-hourtin-port",
  "basse-normandie-mortain-", "basse-normandie-saint-lo-", "basse-normandie-avranches-",
  "haute-normandie-caudebec-en-caux-", "languedoc-roussillon-les-angles-", "provence-alpes-cote-dazur-miramas-",
  "pays-de-la-loire-la-chevroliere-", "pays-de-la-loire-saint-denis-du-payre-", "la-reunion-saint-philippe-",
];

// Cameras published with Viewsurf's public player (pv.viewsurf.com) on other sites.
const EXTRA = [
  { n: "Biarritz Grande Plage (ville) 1", z: "Pays Basque", id: "pv1802", t: "live",
    pv: "https://pv.viewsurf.com/1802/Biarritz-Grande-Plage", page: "https://www.biarritz.fr/les-webcams/grande-plage-1" },
  { n: "Biarritz Grande Plage (ville) 2", z: "Pays Basque", id: "pv772", t: "live",
    pv: "https://pv.viewsurf.com/772/Biarritz-Grande-Plage", page: "https://www.biarritz.fr/les-webcams/grande-plage-2" },
  { n: "Biarritz Rocher de la Vierge", z: "Pays Basque", id: "pv2398", t: "live",
    pv: "https://pv.viewsurf.com/2398/Biarritz-Rocher-de-la-Vierge", page: "https://www.biarritz.fr/les-webcams/rocher-de-la-la-vierge" },
  { n: "Biarritz Côte des Basques", z: "Pays Basque", id: "pv2052", t: "live",
    pv: "https://pv.viewsurf.com/2052/Biarritz-Cote-des-basques", page: "https://www.biarritz.fr/les-webcams/cote-des-basques-panoramique" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (france-surf-cams list updater)" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

function decode(s) {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

function zoneFor(slug) {
  // slug looks like "france-aquitaine-anglet-plage-des-cavaliers"
  const rest = slug.replace(/^france-/, "");
  for (const [region, zone] of Object.entries(REGION_ZONE)) {
    if (rest.startsWith(region + "-")) return zone;
  }
  if (rest.startsWith("aquitaine-")) {
    const town = rest.slice("aquitaine-".length);
    for (const [zone, towns] of Object.entries(AQUITAINE_TOWNS)) {
      if (towns.some((t) => town === t || town.startsWith(t + "-"))) return zone;
    }
  }
  return null;
}

async function previousCount() {
  try { return ((await readFile(OUT, "utf8")).match(/^ \{/gm) || []).length; } catch { return 0; }
}

async function listPages() {
  const seen = new Set();
  const pages = [];
  for (const section of SECTIONS) {
    // The listing page doesn't always return the same set, so read it a few times and merge.
    let list = "";
    for (let i = 0; i < LIST_PASSES; i++) { list += await get(`${ORIGIN}/univers/${section}`); await sleep(DELAY_MS); }
    const re = new RegExp(`href="((?:https://www\\.viewsurf\\.com)?/univers/${section}/vue/(\\d+)-([a-z0-9-]+))"`, "g");
    for (const [, href, id, slug] of list.matchAll(re)) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (!slug.startsWith("france-")) continue; // e.g. Mauritius
      const rest = slug.slice("france-".length);
      if (EXCLUDE.some((x) => rest.startsWith(x))) continue;
      pages.push({ id: +id, slug, url: href.startsWith("http") ? href : ORIGIN + href });
    }
  }
  return pages;
}

async function main() {
  const pages = await listPages();
  console.log(`${pages.length} coastal cameras listed`);

  const cams = [];
  for (const p of pages) {
    try {
      const html = await get(p.url);
      const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      const name = h1 ? decode(h1[1]) : p.slug;
      let zone = zoneFor(p.slug);
      if (!zone) { console.warn(`  unknown zone for ${p.slug} — add its town to AQUITAINE_TOWNS`); zone = "Autres"; }

      const player = html.match(/joada\.net\/embeded\/embeded\.html\?([^"']+)/);
      const params = player && new URLSearchParams(player[1].replace(/&amp;/g, "&"));
      const uuid = params && params.get("uuid");
      if (uuid) {
        cams.push({ n: name, z: zone, id: p.id, uuid, t: params.get("type") || "vod", page: p.url });
        console.log(`  ok    ${zone.padEnd(16)} ${name}`);
      } else if (/class="pano-player"/.test(html)) {
        // Photo panorama refreshed every ~20 min: not embeddable, shown as a link card.
        cams.push({ n: name, z: zone, id: p.id, t: "pano", page: p.url });
        console.log(`  pano  ${zone.padEnd(16)} ${name}`);
      } else {
        // Offline / maintenance, or a player we can't embed: keep it as a link card.
        cams.push({ n: name, z: zone, id: p.id, t: "link", page: p.url });
        console.log(`  link  ${zone.padEnd(16)} ${name} (no embeddable player)`);
      }
    } catch (e) {
      console.warn(`  failed: ${p.url} (${e.message})`);
    }
    await sleep(DELAY_MS);
  }
  cams.push(...EXTRA);

  const before = await previousCount();
  if (before && cams.length < before * MIN_KEEP_RATIO) {
    console.error(`Only ${cams.length} cameras found (was ${before}); keeping the existing cams.js.`);
    process.exit(1);
  }

  const order = (z) => { const i = ZONES.indexOf(z); return i < 0 ? ZONES.length : i; };
  cams.sort((a, b) => order(a.z) - order(b.z) || a.n.localeCompare(b.n, "fr"));

  const out =
    "// Generated by scripts/update-cams.mjs — do not edit by hand.\n" +
    "window.ZONES = " + JSON.stringify(ZONES) + ";\n" +
    "window.CAMS = [\n" + cams.map((c) => " " + JSON.stringify(c)).join(",\n") + "\n];\n";
  await writeFile(OUT, out, "utf8");
  console.log(`Wrote ${cams.length} cameras to ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
