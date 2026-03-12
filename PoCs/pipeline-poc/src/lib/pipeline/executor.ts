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
  context: { tenantId: string; userId: string; scopedUserId?: string },
  userType?: string
): Promise<SqlResult[]> {
  const paginatedParams = ensurePaginationDefaults(params);
  const templates = await loadSqlTemplates(optionId);
  if (templates.length === 0) {
    _sqlCallDebug = [];
    return [];
  }

  if (userType === "citizen") {
    const hasValidation = templates.some((t) => t.execution_order < 0);
    if (!hasValidation) {
      const nonRead = templates.find((t) => t.query_type !== "read");
      if (nonRead) {
        throw new Error("Write operations are not permitted for citizen users");
      }
    }
  }

  const validationTemplates = templates.filter((t) => t.execution_order < 0);
  const executionTemplates = templates.filter((t) => t.execution_order >= 0);

  const results: SqlResult[] = [];
  const debugEntries: SqlCallDebug[] = [];
  const db = createServiceSupabase();

  for (const vt of validationTemplates) {
    const vtParams = mapParams(vt, paginatedParams, context);
    const vtResult = await executeRawQuery(vt.sql, vtParams);
    debugEntries.push({ sql: vt.sql, params: vtParams, rowCount: vtResult.length });

    if (vtResult.length === 0) {
      throw new Error("Validation failed: invalid credentials or insufficient access");
    }

    const validated = vtResult[0];
    if (validated.citizen_id) {
      paginatedParams.validated_citizen_id = validated.citizen_id as string;
    }
  }

  for (const template of executionTemplates) {
    if (template.sql.toUpperCase().includes("DELETE FROM")) {
      throw new Error("Hard deletes are not permitted. Use soft deletes instead.");
    }

    const sqlParams = mapParams(template, paginatedParams, context);

    const { data, error } = await db.rpc("exec_sql", {
      query_text: template.sql,
      query_params: sqlParams,
    });

    if (error) {
      logger.warn("sql.executor", "RPC exec_sql failed, falling back to raw query", {
        error: error.message,
        templateName: template.name,
      });
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

function mapParams(
  template: SqlTemplate,
  params: Record<string, unknown>,
  context: { tenantId: string; userId: string; scopedUserId?: string }
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
      const contextMap: Record<string, unknown> = {
        tenantId: context.tenantId,
        userId: context.userId,
        scopedUserId: context.scopedUserId ?? context.userId,
      };
      sqlParams.push(contextMap[key] ?? null);
    } else if (path.startsWith("params.")) {
      const key = path.replace("params.", "");
      sqlParams.push(params[key] ?? null);
    } else {
      sqlParams.push(null);
    }
  }

  return sqlParams;
}

function ensurePaginationDefaults(
  params: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...params };
  if (!("pageSize" in out) || out.pageSize == null) out.pageSize = 10;
  if (!("page" in out) || out.page == null) out.page = 1;
  out.offset = (Number(out.page) - 1) * Number(out.pageSize);
  return out;
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

