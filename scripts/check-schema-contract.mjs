// Static release guard: client Data API calls must have source-controlled SQL.
// This intentionally runs without credentials, so Demo Mode cannot make it pass by
// replacing the real Supabase client with browser-local data.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoots = ["app", "components", "lib"];

// These tables are intentionally emulated only in Demo Mode. Real accounts use
// browserSettingsStore until a separately approved settings migration exists.
// An access from any new file is a release error, not an automatic exception.
const demoOnlyTableCallers = {
  account_preferences: ["lib/settings/store.ts"],
  test_profiles: ["lib/settings/store.ts"],
};

// Dynamic table names cannot be audited automatically. Review and explicitly
// list the narrowly scoped existing call sites; new dynamic calls fail CI.
const reviewedDynamicCalls = new Set([
  "components/widget-studio.tsx:from:entry.table",
  "components/widget-studio.tsx:from:table",
  "lib/thoughts.ts:from:table",
]);

const listFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return listFiles(path);
  return /\.(?:ts|tsx)$/.test(entry.name) ? [path] : [];
});

export function sqlInventory(sql) {
  const tables = new Set();
  const functions = new Set();
  for (const match of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z][a-z\d_]*)/gi)) tables.add(match[1].toLowerCase());
  for (const match of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z][a-z\d_]*)/gi)) functions.add(match[1].toLowerCase());
  const rlsTables = new Set();
  for (const match of sql.matchAll(/\balter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?([a-z][a-z\d_]*)\s+enable\s+row\s+level\s+security/gi)) rlsTables.add(match[1].toLowerCase());
  return { tables, functions, rlsTables };
}

export function apiReferences(source, file) {
  const syntax = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, syntax);
  const references = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if ((method === "from" || method === "rpc") && node.expression.expression.getText(tree) !== "Array") {
        const arg = node.arguments[0];
        if (arg) references.push({ file, method, name: ts.isStringLiteralLike(arg) ? arg.text : null, expression: arg.getText(tree) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return references;
}

export function contractProblems(references, inventory) {
  const problems = [];
  for (const ref of references) {
    if (ref.name === null) {
      const key = `${ref.file}:${ref.method}:${ref.expression}`;
      if (!reviewedDynamicCalls.has(key)) problems.push(`${ref.file}: unreviewed dynamic .${ref.method}(${ref.expression})`);
      continue;
    }
    if (ref.method === "rpc") {
      if (!inventory.functions.has(ref.name)) problems.push(`${ref.file}: RPC ${ref.name} has no source-controlled CREATE FUNCTION`);
      continue;
    }
    if (demoOnlyTableCallers[ref.name]?.includes(ref.file)) continue;
    if (!inventory.tables.has(ref.name)) problems.push(`${ref.file}: table ${ref.name} has no source-controlled CREATE TABLE`);
    else if (!inventory.rlsTables.has(ref.name)) problems.push(`${ref.file}: table ${ref.name} has no source-controlled ENABLE ROW LEVEL SECURITY`);
  }
  return [...new Set(problems)];
}

export function checkRepository() {
  const migrationPath = join(root, "supabase", "migrations");
  const migrations = readdirSync(migrationPath).filter((name) => name.endsWith(".sql")).sort();
  const inventory = sqlInventory(migrations.map((name) => readFileSync(join(migrationPath, name), "utf8")).join("\n"));
  const references = sourceRoots.flatMap((directory) => listFiles(join(root, directory))).flatMap((file) =>
    apiReferences(readFileSync(file, "utf8"), relative(root, file).replaceAll("\\", "/")));
  const requiredTables = [...new Set(references.filter((ref) => ref.method === "from" && ref.name && !demoOnlyTableCallers[ref.name]?.includes(ref.file)).map((ref) => ref.name))].sort();
  const requiredFunctions = [...new Set(references.filter((ref) => ref.method === "rpc" && ref.name).map((ref) => ref.name))].sort();
  return { problems: contractProblems(references, inventory), tables: inventory.tables.size, functions: inventory.functions.size, references: references.length, requiredTables, requiredFunctions };
}

// Generated from actual code references; run the result read-only on BOTH Supabase
// projects before merging. It cannot be fooled by matching migration filenames.
export function releaseReadinessQuery(tables, functions) {
  const values = (names) => names.length ? names.map((name) => `('${name}')`).join(",\n    ") : "(null)";
  return `-- READ ONLY: generated by npm run db:contract -- --sql
-- Run on staging first, then production. ready must be true on BOTH.
WITH required_tables(name) AS (VALUES
    ${values(tables)}
), required_functions(name) AS (VALUES
    ${values(functions)}
), missing_tables AS (
  SELECT name FROM required_tables WHERE to_regclass('public.' || name) IS NULL
), rls_disabled AS (
  SELECT r.name FROM required_tables r
  JOIN pg_class c ON c.oid = to_regclass('public.' || r.name)
  WHERE NOT c.relrowsecurity
), missing_functions AS (
  SELECT r.name FROM required_functions r WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = r.name
  )
)
SELECT jsonb_build_object(
  'ready', NOT EXISTS(SELECT 1 FROM missing_tables)
    AND NOT EXISTS(SELECT 1 FROM rls_disabled)
    AND NOT EXISTS(SELECT 1 FROM missing_functions),
  'missing_tables', (SELECT coalesce(jsonb_agg(name), '[]'::jsonb) FROM missing_tables),
  'rls_disabled', (SELECT coalesce(jsonb_agg(name), '[]'::jsonb) FROM rls_disabled),
  'missing_functions', (SELECT coalesce(jsonb_agg(name), '[]'::jsonb) FROM missing_functions)
) AS schema_readiness;
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkRepository();
  if (result.problems.length) {
    console.error("Database schema contract FAILED:\n" + result.problems.map((p) => `  - ${p}`).join("\n"));
    process.exitCode = 1;
  } else {
    if (process.argv.includes("--sql")) console.log(releaseReadinessQuery(result.requiredTables, result.requiredFunctions));
    else {
      console.log(`Database schema contract OK: ${result.references} client calls checked against ${result.tables} tables / ${result.functions} functions in migrations.`);
      console.log("This checks source code only. Staging and production migration readiness must also be checked before release.");
    }
  }
}
