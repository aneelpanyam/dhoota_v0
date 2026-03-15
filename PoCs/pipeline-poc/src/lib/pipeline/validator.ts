/**
 * Parameter validation for pipeline execution.
 * Uses option_definitions.input_schema (JSON Schema) to validate params.
 * ajv-formats enables format validation (e.g. email).
 */

import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";

const ajv = new Ajv({ allErrors: true, strict: false, verbose: true });
addFormats(ajv);

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Normalize params before validation.
 * - Coerces string "true"/"false" to boolean for schema properties that expect boolean.
 * - For enum properties: matches value case-insensitively to avoid "must be equal to allowed values" errors.
 * - Removes null/undefined for optional params so validation passes (e.g. optional
 *   banner_keys when user skips; schema type "array" rejects null).
 */
export function normalizeParams(
  params: Record<string, unknown>,
  schema: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return params;
  const props = schema.properties as Record<string, { type?: string; enum?: unknown[]; items?: Record<string, unknown> }> | undefined;
  if (!props || typeof props !== "object") return params;
  const required = (schema.required as string[] | undefined) ?? [];

  const normalized = { ...params };
  for (const [key, prop] of Object.entries(props)) {
    if (prop?.type === "boolean" && key in normalized) {
      const val = normalized[key];
      if (val === "true") normalized[key] = true;
      else if (val === "false") normalized[key] = false;
    }
    // For number: coerce numeric strings (e.g. "123" or "123.45") to number
    if (prop?.type === "number" && key in normalized) {
      const val = normalized[key];
      if (typeof val === "string" && val.trim() !== "") {
        const n = Number(val);
        if (!Number.isNaN(n)) normalized[key] = n;
      }
    }
    // For format date: coerce ISO date-time to YYYY-MM-DD (e.g. "2026-03-14T00:00:00.000Z" -> "2026-03-14")
    if (prop?.format === "date" && key in normalized) {
      const val = normalized[key];
      if (typeof val === "string" && val.trim() !== "") {
        const slice = val.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(slice)) normalized[key] = slice;
      }
    }
    // For format date-time: coerce YYYY-MM-DD to ISO 8601 (e.g. "2026-03-15" -> "2026-03-15T00:00:00.000Z")
    if (prop?.format === "date-time" && key in normalized) {
      const val = normalized[key];
      if (typeof val === "string" && val.trim() !== "") {
        const slice = val.slice(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(slice)) {
          normalized[key] = `${slice}T00:00:00.000Z`;
        }
      }
    }
    // For enum: match case-insensitively and handle display format (e.g. "Worker" -> "worker", "Team Worker" -> "team_worker")
    // Also fix UUID mistakenly sent (e.g. tenant_id leaked when default select has no change event)
    if (prop?.enum && Array.isArray(prop.enum) && key in normalized) {
      const val = normalized[key];
      if (typeof val === "string" && val.trim()) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(val);
        if (isUuid && key === "user_type") {
          normalized[key] = (prop.enum.find((e) => typeof e === "string") as string) ?? "worker";
        } else {
          const lower = val.toLowerCase().replace(/\s+/g, "_");
          const match = prop.enum.find((e) => {
            if (typeof e !== "string") return false;
            const eLower = e.toLowerCase();
            return eLower === lower || e === val || eLower === val.toLowerCase();
          });
          if (match != null) normalized[key] = match;
        }
      }
    }
    // Recurse into array of objects (e.g. provision_bulk users[].user_type)
    if (prop?.type === "array" && prop.items && typeof prop.items === "object" && key in normalized) {
      const arr = normalized[key];
      if (Array.isArray(arr)) {
        const itemProps = (prop.items as Record<string, unknown>).properties as Record<string, { enum?: unknown[] }> | undefined;
        if (itemProps) {
          normalized[key] = arr.map((item) => {
            if (item == null || typeof item !== "object") return item;
            const obj = { ...(item as Record<string, unknown>) };
            for (const [ik, ip] of Object.entries(itemProps)) {
              if (ip?.enum && ik in obj && typeof obj[ik] === "string" && String(obj[ik]).trim()) {
                const v = obj[ik];
                const lower = String(v).toLowerCase().replace(/\s+/g, "_");
                const match = ip.enum.find((e) => typeof e === "string" && e.toLowerCase() === lower);
                if (match != null) obj[ik] = match;
              }
            }
            return obj;
          });
        }
      }
    }
    // Strip null/undefined for optional params so schema validation passes
    // (e.g. optional banner_keys when user skips; schema type "array" rejects null)
    if (!required.includes(key) && normalized[key] == null) {
      delete normalized[key];
    }
  }
  return normalized;
}

/**
 * Validate params against a JSON Schema.
 * Returns { valid: true } or { valid: false, errors: string[] }.
 */
export function validateParams(
  params: Record<string, unknown>,
  schema: Record<string, unknown> | null | undefined
): ValidationResult {
  if (!schema || typeof schema !== "object") {
    return { valid: true };
  }

  try {
    const validate = ajv.compile(schema);
    const valid = validate(params);

    if (valid) {
      return { valid: true };
    }

    const errors = (validate.errors ?? []).map((e) => formatError(e, params));
    return { valid: false, errors };
  } catch (err) {
    return {
      valid: false,
      errors: [`Validation error: ${(err as Error).message}`],
    };
  }
}

function getAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function formatError(e: ErrorObject & { data?: unknown }, params: Record<string, unknown>): string {
  const path = e.instancePath ? e.instancePath.slice(1).replace(/^\//, "") : "";
  const pathKey = path ? path.replace(/\//g, ".") : "";
  const msg = e.message ?? "invalid";

  // Include received value for enum and similar errors to aid debugging
  let received = "";
  if (e.data !== undefined) {
    received = ` (received: ${JSON.stringify(e.data)})`;
  } else if (pathKey) {
    const val = getAtPath(params, pathKey);
    if (val !== undefined) {
      received = ` (received: ${JSON.stringify(val)})`;
    }
  }

  const allowed = (e.params as { allowedValues?: unknown[] })?.allowedValues;
  const allowedStr = allowed ? ` Allowed: ${allowed.map((v) => JSON.stringify(v)).join(", ")}` : "";

  const field = pathKey || "params";
  const parts = [`${field}: ${msg}${received}`];
  if (allowedStr) parts.push(allowedStr);
  return parts.join(". ");
}
