/**
 * Front-end validation helpers for form inputs.
 * Mirrors and complements backend validation (API/validator.ts).
 */

/** Simple email regex - covers most valid addresses */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  return EMAIL_REGEX.test(trimmed);
}

export interface AccessCodeStrengthRules {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireDigit?: boolean;
  requireSpecial?: boolean;
  pattern?: string;
}

export interface AccessCodeValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAccessCodeStrength(
  value: string,
  rules: AccessCodeStrengthRules = {}
): AccessCodeValidationResult {
  const errors: string[] = [];
  const minLength = rules.minLength ?? 6;
  const maxLength = rules.maxLength ?? 32;

  if (value.length < minLength) {
    errors.push(`At least ${minLength} characters required`);
  }
  if (value.length > maxLength) {
    errors.push(`Maximum ${maxLength} characters allowed`);
  }
  if (rules.requireUppercase && !/[A-Z]/.test(value)) {
    errors.push("Must include at least one uppercase letter");
  }
  if (rules.requireLowercase && !/[a-z]/.test(value)) {
    errors.push("Must include at least one lowercase letter");
  }
  if (rules.requireDigit && !/\d/.test(value)) {
    errors.push("Must include at least one digit");
  }
  if (rules.requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)) {
    errors.push("Must include at least one special character");
  }
  if (rules.pattern) {
    try {
      const re = new RegExp(rules.pattern);
      if (!re.test(value)) {
        errors.push("Does not match required format");
      }
    } catch {
      // Invalid regex - skip
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateByFormat(
  value: string,
  format: string
): { valid: boolean; message?: string } {
  switch (format) {
    case "email":
      return isValidEmail(value)
        ? { valid: true }
        : { valid: false, message: "Please enter a valid email address" };
    default:
      return { valid: true };
  }
}

/** ISO date pattern (YYYY-MM-DD) */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
/** ISO date-time pattern (simplified) */
const DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
/** Basic URI pattern */
const URI_REGEX = /^https?:\/\/.+/;

export interface ValidateByParamSchemaResult {
  valid: boolean;
  message?: string;
}

/**
 * Validate a value against a JSON Schema property.
 * Handles format, minLength, maxLength, pattern, enum.
 * For arrays (table), validates each item against schema.items.properties.
 */
export function validateByParamSchema(
  value: unknown,
  schema: Record<string, unknown>
): ValidateByParamSchemaResult {
  if (schema == null || typeof schema !== "object") return { valid: true };

  // Array: validate each element against items
  if (schema.type === "array" && Array.isArray(value)) {
    const items = schema.items as Record<string, unknown> | undefined;
    if (!items || typeof items !== "object") return { valid: true };

    const itemProps = (items.properties as Record<string, Record<string, unknown>>) ?? {};
    const isObjectItems = itemProps && Object.keys(itemProps).length > 0;

    for (let i = 0; i < value.length; i++) {
      const el = value[i];
      if (isObjectItems && el != null && typeof el === "object") {
        const obj = el as Record<string, unknown>;
        for (const [key, propSchema] of Object.entries(itemProps)) {
          if (propSchema && typeof propSchema === "object") {
            const result = validateByParamSchema(obj[key], propSchema);
            if (!result.valid) {
              return { valid: false, message: `Row ${i + 1}, ${key}: ${result.message ?? "invalid"}` };
            }
          }
        }
      } else if (!isObjectItems) {
        const result = validateByParamSchema(el, items);
        if (!result.valid) {
          return { valid: false, message: `Item ${i + 1}: ${result.message ?? "invalid"}` };
        }
      }
    }
    return { valid: true };
  }

  const str = typeof value === "string" ? value : value != null ? String(value) : "";
  const isEmpty = str.trim().length === 0;

  // type: "number" — must be a valid number (reject non-numeric strings)
  if (schema.type === "number" && !isEmpty) {
    const n = Number(str);
    if (Number.isNaN(n)) {
      return { valid: false, message: "Please enter a valid number" };
    }
  }

  const format = schema.format as string | undefined;
  if (format && !isEmpty) {
    switch (format) {
      case "email":
        return isValidEmail(str) ? { valid: true } : { valid: false, message: "Please enter a valid email address" };
      case "date":
        return DATE_REGEX.test(str.slice(0, 10))
          ? { valid: true }
          : { valid: false, message: "Please enter a valid date (YYYY-MM-DD)" };
      case "date-time":
        return DATE_TIME_REGEX.test(str) || DATE_REGEX.test(str.slice(0, 10))
          ? { valid: true }
          : { valid: false, message: "Please enter a valid date or date-time" };
      case "uri":
        return URI_REGEX.test(str) ? { valid: true } : { valid: false, message: "Please enter a valid URL" };
      case "number":
      case "currency":
        return !Number.isNaN(Number(str))
          ? { valid: true }
          : { valid: false, message: "Please enter a valid number" };
      default:
        break;
    }
  }

  const minLength = schema.minLength as number | undefined;
  if (minLength != null && str.length < minLength) {
    return { valid: false, message: `At least ${minLength} characters required` };
  }

  const maxLength = schema.maxLength as number | undefined;
  if (maxLength != null && str.length > maxLength) {
    return { valid: false, message: `Maximum ${maxLength} characters allowed` };
  }

  const pattern = schema.pattern as string | undefined;
  if (pattern && !isEmpty) {
    try {
      const re = new RegExp(pattern);
      if (!re.test(str)) {
        return { valid: false, message: "Does not match required format" };
      }
    } catch {
      // Invalid regex - skip
    }
  }

  const enumVal = schema.enum as unknown[] | undefined;
  if (enumVal && Array.isArray(enumVal) && !isEmpty) {
    if (!enumVal.includes(str) && !enumVal.includes(value)) {
      return { valid: false, message: `Must be one of: ${enumVal.join(", ")}` };
    }
  }

  return { valid: true };
}
