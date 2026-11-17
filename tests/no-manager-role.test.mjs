// MANAGER has been removed. No active code, schema, seed or test may refer to it. Only the
// historical migrations (which must never be edited) and the one migration that removes it may.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Role } from "@/generated/prisma";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".next", "generated", ".git", "migrations", "android-twa"]);
const EXT = /\.(js|jsx|mjs|cjs|ts|tsx|json|prisma|sql|md|css)$/;
const SELF = path.join("tests", "no-manager-role.test.mjs");
// Allowed on purpose: this test, the read-only pre-flight, and the negative test that proves the
// removed role value is REJECTED by the role API.
const ALLOWED = new Set([SELF, path.join("scripts", "role-enum-preflight.sql"), path.join("tests", "supplier-roles.test.mjs")]);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (SKIP_DIRS.has(e.name)) return [];
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : EXT.test(e.name) ? [p] : [];
  });
}

test("no active code, schema, seed or test mentions the removed MANAGER role (or its Persian label)", () => {
  const hits = [];
  for (const dir of ["src", "tests", "prisma", "scripts"]) {
    for (const file of walk(path.join(root, dir))) {
      const rel = path.relative(root, file);
      if (ALLOWED.has(rel)) continue;
      const text = fs.readFileSync(file, "utf8");
      if (/manager/i.test(text) || text.includes("منیجر")) hits.push(rel);
    }
  }
  assert.deepEqual(hits, [], "remove the remaining MANAGER references");
});

test("the generated Role enum has exactly CUSTOMER, ADMIN and SUPPLIER", () => {
  assert.deepEqual(Object.keys(Role).sort(), ["ADMIN", "CUSTOMER", "SUPPLIER"]);
});

test("the database Role enum matches (run after the final migration)", async () => {
  const { prisma } = await import("@/lib/db");
  try {
    const rows = await prisma.$queryRaw`SELECT enumlabel::text AS label FROM pg_enum WHERE enumtypid = '"Role"'::regtype ORDER BY enumsortorder`;
    assert.deepEqual(rows.map((r) => r.label).sort(), ["ADMIN", "CUSTOMER", "SUPPLIER"]);
  } finally {
    await prisma.$disconnect();
  }
});
