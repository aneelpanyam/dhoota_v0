import { createServiceSupabase } from "@/lib/supabase/server";
import type { SqlTemplate } from "@/types/options";
import type { SqlResult } from "@/types/pipeline";
import type { SqlCallDebug } from "./trace";
import { loadSqlTemplates } from "./loader";
import { logger } from "@/lib/logging/logger";

let _sqlCallDebug: SqlCallDebug[] | null = null;

export function consumeSqlDebug(): SqlCallDebug[] | null {
  const d = _sqlCallDebug;
  _sqlCallDebug = null;
  return d;
}

export async function executeSqlTemplates(
  optionId: string,
  params: Record<string, unknown>,
  context: { tenantId: string; userId: string }
): Promise<SqlResult[]> {
  const templates = await loadSqlTemplates(optionId);
  if (templates.length === 0) {
    _sqlCallDebug = [];
    return [];
  }

  const results: SqlResult[] = [];
  const debugEntries: SqlCallDebug[] = [];
  const db = createServiceSupabase();

  for (const template of templates) {
    const sqlParams = mapParams(template, params, context);

    const { data, error } = await db.rpc("exec_sql", {
      query_text: template.sql,
      query_params: sqlParams,
    });

    if (error) {
      const result = await executeRawQuery(template.sql, sqlParams);
      results.push({
        templateName: template.name,
        rows: result,
        rowCount: result.length,
        queryType: template.query_type as "read" | "write",
      });
      debugEntries.push({ sql: template.sql, params: sqlParams, rowCount: result.length });
    } else {
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      results.push({
        templateName: template.name,
        rows,
        rowCount: rows.length,
        queryType: template.query_type as "read" | "write",
      });
      debugEntries.push({ sql: template.sql, params: sqlParams, rowCount: rows.length });
    }
  }

  _sqlCallDebug = debugEntries;
  return results;
}

export async function executeDynamicQuery(
  sql: string,
  tenantId: string
): Promise<SqlResult> {
  validateDynamicSQL(sql);

  const result = await executeRawQuery(sql, [tenantId]);
  return {
    templateName: "dynamic_query",
    rows: result,
    rowCount: result.length,
    queryType: "read",
  };
}

function mapParams(
  template: SqlTemplate,
  params: Record<string, unknown>,
  context: { tenantId: string; userId: string }
): unknown[] {
  const mapping = template.param_mapping as Record<string, string>;
  const maxParam = Math.max(
    ...Object.keys(mapping).map((k) => parseInt(k.replace("$", ""), 10)),
    0
  );

  const sqlParams: unknown[] = [];
  for (let i = 1; i <= maxParam; i++) {
    const path = mapping[`$${i}`];
    if (!path) {
      sqlParams.push(null);
      continue;
    }

    if (path.startsWith("context.")) {
      const key = path.replace("context.", "");
      sqlParams.push(key === "tenantId" ? context.tenantId : key === "userId" ? context.userId : null);
    } else if (path.startsWith("params.")) {
      const key = path.replace("params.", "");
      sqlParams.push(params[key] ?? null);
    } else {
      sqlParams.push(null);
    }
  }

  return sqlParams;
}

async function executeRawQuery(
  sql: string,
  params: unknown[]
): Promise<Record<string, unknown>[]> {
  const db = createServiceSupabase();

  let processedSql = sql;
  for (let i = params.length; i >= 1; i--) {
    const val = params[i - 1];
    const replacement =
      val === null
        ? "NULL"
        : typeof val === "number"
        ? String(val)
        : `'${String(val).replace(/'/g, "''")}'`;
    processedSql = processedSql.replace(new RegExp(`\\$${i}`, "g"), replacement);
  }

  const { data, error } = await db.rpc("exec_raw_sql", {
    query_text: processedSql,
  });

  if (error) {
    logger.error("sql.executor", "SQL execution error", { error: error.message, sql: processedSql.slice(0, 500) });
    throw new Error(`SQL execution failed: ${error.message}`);
  }

  return Array.isArray(data) ? data : data ? [data] : [];
}

function validateDynamicSQL(sql: string): void {
  const normalized = sql.trim().toUpperCase();

  if (!normalized.startsWith("SELECT")) {
    throw new Error("Dynamic SQL must be a SELECT statement");
  }

  const forbidden = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE",
    "TRUNCATE", "EXEC", "EXECUTE", "GRANT", "REVOKE",
  ];

  for (const keyword of forbidden) {
    const regex = new RegExp(`\\b${keyword}\\b`);
    if (regex.test(normalized)) {
      throw new Error(`Forbidden keyword in dynamic SQL: ${keyword}`);
    }
  }
}
