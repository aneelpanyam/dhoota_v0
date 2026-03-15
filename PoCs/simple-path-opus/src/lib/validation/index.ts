import { z } from "zod";
import { getTraceId } from "@/lib/tracing";

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationFailure {
  success: false;
  errors: FieldError[];
  traceId: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Validate data against a Zod schema.
 * Returns structured result with field-level errors and trace ID on failure.
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: FieldError[] = result.error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  let traceId = "no-trace";
  try {
    traceId = getTraceId();
  } catch {
    // Outside server context
  }

  return { success: false, errors, traceId };
}

/**
 * Validate and throw on failure. Use in server actions where you want
 * to bail early with a structured error.
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = validate(schema, data);
  if (!result.success) {
    throw new ValidationError(result.errors, result.traceId);
  }
  return result.data;
}

export class ValidationError extends Error {
  public readonly errors: FieldError[];
  public readonly traceId: string;

  constructor(errors: FieldError[], traceId: string) {
    const summary = errors.map((e) => `${e.field}: ${e.message}`).join("; ");
    super(`Validation failed: ${summary}`);
    this.name = "ValidationError";
    this.errors = errors;
    this.traceId = traceId;
  }
}
