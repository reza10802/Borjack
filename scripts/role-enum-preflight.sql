-- READ-ONLY pre-flight for the MANAGER -> SUPPLIER migration. Safe to run on production:
-- it only SELECTs. Run it with psql and send the output back BEFORE migration 3.
--   psql "$DATABASE_URL" -f scripts/role-enum-preflight.sql

\echo '== 1. Users per role / active state'
SELECT role::text AS role, "isActive", count(*) FROM "User" GROUP BY 1, 2 ORDER BY 1, 2;

\echo '== 2. MANAGER accounts (each needs an explicit decision: SUPPLIER / CUSTOMER / blocked)'
SELECT u.id, u.name, u.phone, u."isActive", u."createdAt",
       (SELECT count(*) FROM "AuditLog" a WHERE a."userId" = u.id) AS audit_rows,
       (SELECT count(*) FROM "Task" t WHERE t."fromId" = u.id OR t."toId" = u.id) AS task_rows,
       (SELECT count(*) FROM "Order" o WHERE o."userId" = u.id) AS own_orders
FROM "User" u WHERE u.role::text = 'MANAGER' ORDER BY u."createdAt";

\echo '== 3. Every object that depends on the "Role" type (expected: only column User.role)'
SELECT pg_describe_object(d.classid, d.objid, d.objsubid) AS dependent, d.deptype
FROM pg_depend d
WHERE d.refclassid = 'pg_type'::regclass AND d.refobjid = '"Role"'::regtype
  AND d.deptype <> 'i'
ORDER BY 1;

\echo '== 4. Columns typed "Role" and their defaults (expected: one row, default CUSTOMER)'
SELECT c.relname AS table_name, a.attname AS column_name, pg_get_expr(ad.adbin, ad.adrelid) AS column_default
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
WHERE a.atttypid = '"Role"'::regtype AND a.attnum > 0 AND NOT a.attisdropped AND n.nspname = current_schema();

\echo '== 5. Views / functions mentioning Role (expected: none)'
WITH f AS MATERIALIZED (
  SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = current_schema() AND p.prokind = 'f'
)
SELECT 'view' AS kind, schemaname || '.' || viewname AS name FROM pg_views
 WHERE schemaname = current_schema() AND definition ILIKE '%Role%'
UNION ALL
SELECT 'function', oid::regprocedure::text FROM f WHERE pg_get_functiondef(oid) ILIKE '%"Role"%';

\echo '== 6. Current enum labels'
SELECT enumlabel FROM pg_enum WHERE enumtypid = '"Role"'::regtype ORDER BY enumsortorder;
