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
