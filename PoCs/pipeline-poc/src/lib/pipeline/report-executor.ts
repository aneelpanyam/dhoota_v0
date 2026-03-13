import { createServiceSupabase } from "@/lib/supabase/server";
import { loadReportTemplates } from "./loader";
import type { ReportTemplate } from "@/types/pipeline";

export interface ReportChartResult {
  templateName: string;
  chartType: string;
  chartTitle: string;
  labelColumn: string | null;
  valueColumns: string[];
  rows: Record<string, unknown>[];
}

export interface ReportContext {
  tenantId: string;
  userId: string;
}

function mapReportParams(
  paramMapping: Record<string, string>,
  context: ReportContext,
  params?: Record<string, unknown>
): unknown[] {
  const maxParam = Math.max(
    ...Object.keys(paramMapping).map((k) => parseInt(k.replace("$", ""), 10)),
    0
  );
  const result: unknown[] = [];
  for (let i = 1; i <= maxParam; i++) {
    const path = paramMapping[`$${i}`];
    if (!path) {
      result.push(null);
      continue;
    }
    if (path.startsWith("context.")) {
      const key = path.replace("context.", "");
      result.push(key === "tenantId" ? context.tenantId : context.userId);
    } else if (path.startsWith("params.") && params) {
      const key = path.replace("params.", "");
      result.push(params[key] ?? null);
    } else {
      result.push(null);
    }
  }
  return result;
}

async function executeReportQuery(
  sql: string,
  params: unknown[]
): Promise<Record<string, unknown>[]> {
  const db = createServiceSupabase();
  const { data, error } = await db.rpc("exec_sql", {
    query_text: sql,
    query_params: params,
  });

  if (error) {
    throw new Error(`Report query failed: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows as Record<string, unknown>[];
}

export async function executeReportTemplates(
  reportId: string,
  context: ReportContext,
  params?: Record<string, unknown>
): Promise<ReportChartResult[]> {
  const templates = await loadReportTemplates(reportId);
  if (templates.length === 0) {
    return [];
  }

  const results = await Promise.all(
    templates.map(async (template: ReportTemplate) => {
      const paramMapping = (template.param_mapping ?? {}) as Record<string, string>;
      const sqlParams = mapReportParams(paramMapping, context, params);
      const rows = await executeReportQuery(template.sql, sqlParams);

      return {
        templateName: template.name,
        chartType: template.chart_type ?? "bar",
        chartTitle: template.chart_title,
        labelColumn: template.label_column ?? null,
        valueColumns: template.value_columns ?? [],
        rows,
      };
    })
  );

  return results;
}
