// Safety guards for the DESTRUCTIVE seed. The seed truncates every table, so it must be
// impossible to run it against production data by accident. ALL of the following must hold:
//   1. NODE_ENV is not "production"
//   2. the database host is on the local allow-list
//   3. the database name ends with _dev, _test, _seed or _local (or -dev, ...)
//   4. SEED_CONFIRM_DB equals the database name exactly (typed on purpose)
//   5. every user already in the database is a seed account (a single real user blocks the wipe)
// SEED_ALLOW_REMOTE no longer exists: it is ignored (with a warning) and bypasses nothing.
import { SEED_USER_PHONES } from "./users.js";

export const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
  "::1",
  "postgres", // docker compose service name (still subject to checks 3-5)
  "db",
  "host.docker.internal",
]);

export const SAFE_DB_NAME = /[_-](dev|test|seed|local)$/i;

// Accounts created by the previous seed generations, so an old test database can still be rebuilt.
export const LEGACY_SEED_PHONES = [
  "09116001260", "09116011003", "09120000003", "09120000004", "09120000005", "09120000006",
  "09120000007", "09120000008", "09120000009", "09120000010", "09120000011", "09120000012",
  "09120000013", "09120000014", "09120000015",
];

export class SeedRefusal extends Error {
  constructor(message) {
    super(message);
    this.name = "SeedRefusal";
  }
}

const maskPhone = (phone) => (phone.length > 6 ? `${phone.slice(0, 2)}******${phone.slice(-3)}` : "***");

export function assertSafeSeedTarget(env = process.env) {
  const url = env.DATABASE_URL;
  if (!url) throw new SeedRefusal("DATABASE_URL is not set (check your .env file).");

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new SeedRefusal("DATABASE_URL is not a valid URL.");
  }

  if (env.NODE_ENV === "production") {
    throw new SeedRefusal("Refusing to seed with NODE_ENV=production. This script deletes ALL data.");
  }

  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    throw new SeedRefusal(
      `Refusing to wipe a non-local database (host "${parsed.hostname}"). The seed only runs against local databases.`,
    );
  }

  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!dbName) throw new SeedRefusal("DATABASE_URL has no database name.");

  if (!SAFE_DB_NAME.test(dbName)) {
    throw new SeedRefusal(
      `Refusing to wipe database "${dbName}": its name must end with _dev, _test, _seed or _local.`,
    );
  }

  if (env.SEED_CONFIRM_DB !== dbName) {
    throw new SeedRefusal(
      `Refusing to wipe "${dbName}" without confirmation: set SEED_CONFIRM_DB=${dbName} (typed exactly).`,
    );
  }

  return { dbName, host: parsed.hostname };
}

export function assertOnlySeedUsers(existingPhones) {
  const allowed = new Set([...SEED_USER_PHONES, ...LEGACY_SEED_PHONES]);
  const foreign = existingPhones.filter((phone) => !allowed.has(phone));

  if (foreign.length) {
    throw new SeedRefusal(
      `Refusing to wipe: ${foreign.length} existing user(s) are not seed accounts (e.g. ${maskPhone(foreign[0])}). ` +
        "This database looks like it holds real or test data that is not from the seed.",
    );
  }
}

export function removedFlagWarnings(env = process.env) {
  return env.SEED_ALLOW_REMOTE !== undefined
    ? ["SEED_ALLOW_REMOTE is no longer supported and is ignored. It does not bypass any safety check."]
    : [];
}
