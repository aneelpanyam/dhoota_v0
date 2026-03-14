/**
 * Parameter validation for pipeline execution.
 * Uses option_definitions.input_schema (JSON Schema) to validate params.
 */

import Ajv, { type ErrorObject } from "ajv";

const ajv = new Ajv({ allErrors: true, strict: false });

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Normalize params before validation.
 * Coerces string "true"/"false" to boolean for schema properties that expect boolean.
 * Select questions often return strings; this fixes validation failures.
 */
export function normalizeParams(
  params: Record<string, unknown>,
  schema: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return params;
  const props = schema.properties as Record<string, { type?: string }> | undefined;
  if (!props || typeof props !== "object") return params;

  const normalized = { ...params };
  for (const [key, prop] of Object.entries(props)) {
    if (prop?.type === "boolean" && key in normalized) {
      const val = normalized[key];
      if (val === "true") normalized[key] = true;
      else if (val === "false") normalized[key] = false;
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

    const errors = (validate.errors ?? []).map(formatError);
    return { valid: false, errors };
  } catch (err) {
    return {
      valid: false,
      errors: [`Validation error: ${(err as Error).message}`],
    };
  }
}

function formatError(e: ErrorObject): string {
  const path = e.instancePath ? e.instancePath.slice(1) : "params";
  const msg = e.message ?? "invalid";
  return path ? `${path}: ${msg}` : msg;
}
