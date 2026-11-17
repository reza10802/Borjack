// Live check that NOTHING about suppliers leaks into public output.
// Crawls a running Borjak server (pages, RSC/HTML, JSON APIs, sitemap, JSON-LD) and fails if any
// response contains a supplier's id, name or phone number, or the words "supplierId" / "ownerId".
// It also checks that product pages name Borjak as the seller in their JSON-LD.
//
//   DATABASE_URL=...  node scripts/public-leak-check.mjs http://127.0.0.1:3000
//
// Run it against a TEST/staging database seeded with prisma/seed.js, never against production.
import pg from "pg";

const base = (process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const { rows: suppliers } = await pool.query(`SELECT id, name, phone FROM "User" WHERE role::text = 'SUPPLIER'`);
await pool.end();
if (!suppliers.length) throw new Error("No SUPPLIER users in the database: seed it first.");

const persianDigits = (s) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[d]);
const needles = [];
for (const s of suppliers) {
  needles.push({ what: `supplier id ${s.id}`, text: s.id });
  needles.push({ what: `supplier phone ${s.phone}`, text: s.phone });
  needles.push({ what: `supplier phone (fa digits) ${s.phone}`, text: persianDigits(s.phone) });
  needles.push({ what: `supplier phone (+98) ${s.phone}`, text: "+98" + s.phone.slice(1) });
  needles.push({ what: `supplier name "${s.name}"`, text: s.name });
}
for (const word of ["supplierId", "ownerId"]) needles.push({ what: `field name ${word}`, text: word });

const findings = [];
const seen = new Set();
const queue = ["/", "/sitemap.xml", "/api/products", "/api/products?limit=100"];
let pages = 0, jsonLdProducts = 0, jsonLdOk = 0;

async function visit(url) {
  if (seen.has(url) || seen.size > 600) return;
  seen.add(url);
  const res = await fetch(base + url, { redirect: "manual", headers: { accept: "text/html,application/json,*/*" } });
  const type = res.headers.get("content-type") || "";
  if (res.status >= 300 && res.status < 400) return;
  const body = await res.text();
  pages += 1;
  if (res.status >= 500) findings.push({ url, problem: `HTTP ${res.status}` });
  for (const n of needles) if (n.text && body.includes(n.text)) findings.push({ url, problem: `contains ${n.what}` });

  if (/\/products\/[^/?]+$/.test(url) && !url.startsWith("/api/") && res.status === 200) {
    const blocks = [...body.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    const productLd = blocks.map((b) => { try { return JSON.parse(b); } catch { return null; } }).find((j) => j && j["@type"] === "Product");
    if (productLd?.offers) {
      jsonLdProducts += 1;
      if (productLd.offers.seller?.name === "Borjak") jsonLdOk += 1;
      else findings.push({ url, problem: "Product JSON-LD offer does not name Borjak as seller" });
    }
  }

  if (type.includes("json")) {
    try {
      const j = JSON.parse(body);
      for (const p of Array.isArray(j) ? j : j.products || j.items || []) if (p?.slug) queue.push(`/api/products/${encodeURIComponent(p.slug)}`);
    } catch { /* ignore */ }
  }
  if (type.includes("xml")) {
    for (const m of body.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const pathname = new URL(m[1]).pathname;
      queue.push(pathname);
      const prod = pathname.match(/^\/products\/([^/]+)$/);
      if (prod) queue.push(`/api/products/${prod[1]}`);
    }
  }
  if (type.includes("html")) {
    for (const m of body.matchAll(/href="(\/[^"#?]*)"/g)) {
      const href = m[1];
      if (/^\/(category|brand|tag|products|search)\b/.test(href)) queue.push(href);
      // every product page also has a public JSON API; check that output as well
      const prod = href.match(/^\/products\/([^/]+)$/);
      if (prod) queue.push(`/api/products/${prod[1]}`);
    }
  }
}

while (queue.length) await visit(queue.shift());

console.log(`Checked ${pages} public URLs against ${suppliers.length} suppliers (${needles.length} needles).`);
console.log(`Product pages with Offer JSON-LD: ${jsonLdProducts}, naming Borjak as seller: ${jsonLdOk}.`);
if (findings.length) {
  for (const f of findings.slice(0, Number(process.env.LEAK_REPORT_LIMIT || 40))) console.error(`LEAK  ${f.url}  ${f.problem}`);
  process.exit(1);
}
if (!jsonLdProducts) { console.error("No product page with JSON-LD was found, so the seller check did not run."); process.exit(1); }
console.log("OK: no supplier id, name, phone or owner field appears in any public response.");
