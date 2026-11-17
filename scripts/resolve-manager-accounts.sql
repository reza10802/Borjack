-- Resolve every MANAGER account BEFORE the new application build is deployed.
--
-- Why this must run first: the new build has no MANAGER role. Prisma throws on any row that
-- still has it, so the admin user list and that user's login would fail. The old admin UI can
-- only choose CUSTOMER/MANAGER, so the conversion is done here, in one reviewed transaction.
--
-- Order of operations (see the migration plan):
--   1. pg_dump                         4. psql -f scripts/resolve-manager-accounts.sql   <- this file
--   2. scripts/role-enum-preflight.sql 5. deploy the new build
--   3. apply migrations 1 and 2        6. apply migration 3 (removes MANAGER from the enum)
--
-- HOW: list one decision per MANAGER account below (the pre-flight report shows them), then run
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/resolve-manager-accounts.sql
-- Decisions:  SUPPLIER = becomes a supplier (needs an active account and a verified phone)
--             CUSTOMER = becomes a normal customer
--             BLOCK    = becomes a CUSTOMER and is blocked (isActive = false)
-- Nothing is deleted. Products are not touched (legacy products stay Borjak-owned, supplierId NULL).
-- The script is all-or-nothing: if any MANAGER has no decision, or anything looks wrong, it aborts
-- and changes nothing. Sessions of every resolved account are revoked (tokenVersion + 1) and one
-- UPDATE_USER audit entry per account records the previous role.
--
-- ROLLBACK: the audit entries hold the old role; or restore the pg_dump from step 1.

BEGIN;

CREATE TEMP TABLE decisions (phone text PRIMARY KEY, decision text NOT NULL CHECK (decision IN ('SUPPLIER', 'CUSTOMER', 'BLOCK')));

-- >>> EDIT HERE: one line per MANAGER account, e.g.  ('09120000000', 'SUPPLIER'),
INSERT INTO decisions (phone, decision) VALUES
  -- ('09xxxxxxxxx', 'SUPPLIER'),
  -- ('09xxxxxxxxx', 'CUSTOMER'),
  -- ('09xxxxxxxxx', 'BLOCK'),
  ('__end__', 'CUSTOMER');
DELETE FROM decisions WHERE phone = '__end__';
-- <<<

DO $$
DECLARE
  missing text;
  unknown text;
  not_manager text;
  not_eligible text;
BEGIN
  SELECT string_agg(u.phone, ', ') INTO missing
    FROM "User" u LEFT JOIN decisions d ON d.phone = u.phone
   WHERE u.role::text = 'MANAGER' AND d.phone IS NULL;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'No decision for MANAGER account(s): %', missing;
  END IF;

  SELECT string_agg(d.phone, ', ') INTO unknown FROM decisions d LEFT JOIN "User" u ON u.phone = d.phone WHERE u.id IS NULL;
  IF unknown IS NOT NULL THEN
    RAISE EXCEPTION 'Decision for unknown phone number(s): %', unknown;
  END IF;

  SELECT string_agg(d.phone, ', ') INTO not_manager FROM decisions d JOIN "User" u ON u.phone = d.phone WHERE u.role::text <> 'MANAGER';
  IF not_manager IS NOT NULL THEN
    RAISE EXCEPTION 'Decision for account(s) that are not MANAGER: %', not_manager;
  END IF;

  SELECT string_agg(d.phone, ', ') INTO not_eligible
    FROM decisions d JOIN "User" u ON u.phone = d.phone
   WHERE d.decision = 'SUPPLIER' AND (NOT u."isActive" OR NOT u."isPhoneVerified");
  IF not_eligible IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot make SUPPLIER (inactive or unverified phone): %', not_eligible;
  END IF;
END
$$;

-- audit first (needs the old role), then change the accounts
INSERT INTO "AuditLog" (id, action, "entityType", "entityId", description, "oldValue", "newValue", "userLabel")
SELECT 'mgr_' || md5(random()::text || clock_timestamp()::text || u.id),
       'UPDATE_USER'::"LogAction", 'User', u.id,
       'Removal of the MANAGER role: ' || u.name || ' MANAGER -> ' ||
         CASE d.decision WHEN 'SUPPLIER' THEN 'SUPPLIER' WHEN 'CUSTOMER' THEN 'CUSTOMER' ELSE 'CUSTOMER (blocked)' END,
       jsonb_build_object('role', u.role::text, 'isActive', u."isActive"),
       jsonb_build_object('role', CASE d.decision WHEN 'SUPPLIER' THEN 'SUPPLIER' ELSE 'CUSTOMER' END,
                          'isActive', CASE WHEN d.decision = 'BLOCK' THEN false ELSE u."isActive" END),
       'migration script'
  FROM "User" u JOIN decisions d ON d.phone = u.phone;

UPDATE "User" u
   SET role = CASE d.decision WHEN 'SUPPLIER' THEN 'SUPPLIER'::"Role" ELSE 'CUSTOMER'::"Role" END,
       "isActive" = CASE WHEN d.decision = 'BLOCK' THEN false ELSE u."isActive" END,
       "tokenVersion" = u."tokenVersion" + 1,
       "updatedAt" = now()
  FROM decisions d
 WHERE d.phone = u.phone;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE role::text = 'MANAGER') THEN
    RAISE EXCEPTION 'MANAGER accounts remain; nothing was changed';
  END IF;
END
$$;

SELECT u.phone, u.name, u.role::text AS new_role, u."isActive" FROM "User" u JOIN decisions d ON d.phone = u.phone ORDER BY u.phone;

COMMIT;
