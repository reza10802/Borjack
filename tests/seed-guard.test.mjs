// The seed is DESTRUCTIVE (truncates every table). These tests cover every condition under
// which it must refuse, both as pure guard checks and by really spawning `node prisma/seed.js`
// and confirming no data was erased.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  assertSafeSeedTarget,
  assertOnlySeedUsers,
  removedFlagWarnings,
  SeedRefusal,
  SAFE_DB_NAME,
} from "../prisma/seed/guards.js";
import { SEED_USER_PHONES } from "../prisma/seed/users.js";
import { prisma } from "@/lib/db";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ok = { DATABASE_URL: "postgresql://u:p@localhost:5432/borjak_seed_test", SEED_CONFIRM_DB: "borjak_seed_test", NODE_ENV: "development" };
const refuses = (env, re) => assert.throws(() => assertSafeSeedTarget(env), (e) => e instanceof SeedRefusal && re.test(e.message));

after(() => prisma.$disconnect());

test("guard: a correct local test database with typed confirmation is accepted", () => {
  assert.deepEqual(assertSafeSeedTarget(ok), { dbName: "borjak_seed_test", host: "localhost" });
  for (const suffix of ["dev", "test", "seed", "local"]) assert.ok(SAFE_DB_NAME.test(`borjak_${suffix}`));
});

test("guard: refuses NODE_ENV=production", () => refuses({ ...ok, NODE_ENV: "production" }, /production/));

test("guard: refuses a non-local host", () => {
  refuses({ ...ok, DATABASE_URL: "postgresql://u:p@db.example.com:5432/borjak_seed_test" }, /non-local/);
  refuses({ ...ok, DATABASE_URL: "postgresql://u:p@203.0.113.7:5432/borjak_seed_test" }, /non-local/);
});

test("guard: refuses database names without a dev/test/seed/local suffix", () => {
  for (const name of ["borjak", "myshop", "borjak_prod", "production", "testing", "dev_data"]) {
    refuses({ ...ok, DATABASE_URL: `postgresql://u:p@localhost:5432/${name}`, SEED_CONFIRM_DB: name }, /must end with/);
  }
});

test("guard: refuses without, or with a wrong, SEED_CONFIRM_DB", () => {
  refuses({ ...ok, SEED_CONFIRM_DB: undefined }, /SEED_CONFIRM_DB/);
  refuses({ ...ok, SEED_CONFIRM_DB: "borjak_seed" }, /SEED_CONFIRM_DB/);
  refuses({ ...ok, SEED_CONFIRM_DB: "BORJAK_SEED_TEST" }, /SEED_CONFIRM_DB/);
  refuses({ ...ok, SEED_CONFIRM_DB: "" }, /SEED_CONFIRM_DB/);
});

test("guard: refuses a missing or invalid DATABASE_URL", () => {
  refuses({ ...ok, DATABASE_URL: undefined }, /not set/);
  refuses({ ...ok, DATABASE_URL: "not a url" }, /not a valid URL/);
});

test("guard: SEED_ALLOW_REMOTE is gone, ignored with a warning, and bypasses nothing", () => {
  const env = { ...ok, DATABASE_URL: "postgresql://u:p@db.example.com:5432/borjak_prod", SEED_CONFIRM_DB: "borjak_prod", SEED_ALLOW_REMOTE: "true" };
  refuses(env, /non-local/);
  refuses({ ...env, NODE_ENV: "production", DATABASE_URL: ok.DATABASE_URL, SEED_CONFIRM_DB: ok.SEED_CONFIRM_DB }, /production/);
  assert.equal(removedFlagWarnings(env).length, 1);
  assert.equal(removedFlagWarnings(ok).length, 0);
});

test("tripwire: any non-seed user blocks the wipe; seed and legacy accounts and an empty DB do not", () => {
  assertOnlySeedUsers([]);
  assertOnlySeedUsers(SEED_USER_PHONES);
  assertOnlySeedUsers(["09116001260", "09120000015"]); // legacy seed accounts
  assert.throws(() => assertOnlySeedUsers([...SEED_USER_PHONES, "09351234567"]), (e) => e instanceof SeedRefusal && /not seed accounts/.test(e.message) && !e.message.includes("09351234567"));
});

function runSeed(env) {
  return spawnSync(process.execPath, ["prisma/seed.js"], {
    cwd: root,
    env: { PATH: process.env.PATH, JWT_SECRET: process.env.JWT_SECRET, ...env },
    encoding: "utf8",
    timeout: 60000,
  });
}

const counts = async () => (await prisma.$queryRaw`SELECT (SELECT COUNT(*) FROM "User")::int AS users, (SELECT COUNT(*) FROM "Product")::int AS products, (SELECT COUNT(*) FROM "Order")::int AS orders`)[0];

test("real run: every refusal exits non-zero and erases nothing", async () => {
  const dbUrl = process.env.DATABASE_URL;
  const dbName = new URL(dbUrl).pathname.slice(1);
  const before = await counts();
  const cases = [
    ["production env", { DATABASE_URL: dbUrl, SEED_CONFIRM_DB: dbName, NODE_ENV: "production" }],
    ["remote host", { DATABASE_URL: "postgresql://u:p@db.example.com:5432/borjak_seed_test", SEED_CONFIRM_DB: "borjak_seed_test", NODE_ENV: "test" }],
    ["remote host + removed flag", { DATABASE_URL: "postgresql://u:p@db.example.com:5432/borjak_seed_test", SEED_CONFIRM_DB: "borjak_seed_test", NODE_ENV: "test", SEED_ALLOW_REMOTE: "true" }],
    ["bad database name", { DATABASE_URL: dbUrl.replace(/\/[^/]+$/, "/borjak_prod"), SEED_CONFIRM_DB: "borjak_prod", NODE_ENV: "test" }],
    ["no confirmation", { DATABASE_URL: dbUrl, NODE_ENV: "test" }],
    ["wrong confirmation", { DATABASE_URL: dbUrl, SEED_CONFIRM_DB: "something_else", NODE_ENV: "test" }],
  ];
  for (const [label, env] of cases) {
    const res = runSeed(env);
    assert.notEqual(res.status, 0, `${label}: seed must exit non-zero`);
    assert.match(res.stdout + res.stderr, /Seed refused/, `${label}: must be a deliberate refusal`);
  }
  assert.deepEqual(await counts(), before, "no refusal may erase data");
});

test("real run: a database holding a non-seed user is never wiped", async (t) => {
  const dbUrl = process.env.DATABASE_URL;
  const dbName = new URL(dbUrl).pathname.slice(1);
  if (!SAFE_DB_NAME.test(dbName)) return t.skip(`DATABASE_URL database "${dbName}" lacks a safe suffix; the name check already refuses it`);
  const phone = "09" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");
  await prisma.user.create({ data: { name: "Real Person", phone, password: "x", isPhoneVerified: true } });
  const before = await counts();
  const res = runSeed({ DATABASE_URL: dbUrl, SEED_CONFIRM_DB: dbName, NODE_ENV: "test" });
  assert.notEqual(res.status, 0);
  assert.match(res.stdout + res.stderr, /not seed accounts/);
  assert.ok(!(res.stdout + res.stderr).includes(phone), "the phone number must not be printed in full");
  assert.deepEqual(await counts(), before);
  assert.ok(await prisma.user.findUnique({ where: { phone } }), "the user is still there");
});
