import type { SqlParam, SqlParamType } from "@/lib/query/templates";

export function assertSelectOnly(sql: string): void {
  const stripped = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .trim();

  if (!/^select\b/i.test(stripped)) {
    throw new Error("Only SELECT statements are allowed");
  }

  const withoutTrailing = stripped.replace(/;+\s*$/, "");
  if (withoutTrailing.includes(";")) {
    throw new Error("Only a single SELECT statement is allowed");
  }

  if (
    /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|execute|call)\b/i.test(
      withoutTrailing,
    )
  ) {
    throw new Error("Only SELECT statements are allowed");
  }
}

export function bindTemplateSql(
  sql: string,
  params: Record<string, string | number>,
  definitions: SqlParam[],
): string {
  assertSelectOnly(sql);

  const names = definitions
    .map((definition) => definition.name)
    .sort((left, right) => right.length - left.length);

  let bound = sql;
  for (const name of names) {
    const definition = definitions.find((item) => item.name === name);
    if (!definition) continue;
    if (params[name] === undefined) {
      throw new Error(`Missing parameter ${name}`);
    }
    const literal = sqlLiteral(definition.type, params[name]);
    bound = bound.replaceAll(new RegExp(`:${name}\\b`, "g"), literal);
  }

  if (/(^|[^a-z0-9_]):[a-z_][a-z0-9_]*/i.test(bound)) {
    throw new Error("Unbound SQL placeholder");
  }

  assertSelectOnly(bound);
  return bound;
}

function sqlLiteral(type: SqlParamType, value: string | number): string {
  if (type === "date") {
    return `'${value}'`;
  }
  return String(value);
}
