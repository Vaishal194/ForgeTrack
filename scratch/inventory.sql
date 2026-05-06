-- DATABASE INVENTORY
-- This script lists all custom objects to find any broken dependencies.

SELECT '--- FUNCTIONS ---' as category;
SELECT n.nspname as schema, p.proname as name, pg_get_function_result(p.oid) as result, pg_get_function_arguments(p.oid) as args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
ORDER BY schema, name;

SELECT '--- TRIGGERS ---' as category;
SELECT n.nspname as schema, t.relname as table, tgname as trigger
FROM pg_trigger
JOIN pg_class t ON tgrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
AND tgisinternal = false;

SELECT '--- POLICIES ---' as category;
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'auth');
