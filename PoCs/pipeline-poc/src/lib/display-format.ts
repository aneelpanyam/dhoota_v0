/**
 * Format any value for human-readable display.
 * Avoids [object Object] for objects/arrays; shows counts for file-like arrays.
 */
export function formatValueForDisplay(value: unknown, key?: string): string {
  if (value == null || value === "") return "";

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (key === "amount") return `$${value.toFixed(2)}`;
    return String(value);
  }

  if (typeof value === "string") {
    if (key === "amount") {
      const n = Number(value.replace(/[^0-9.-]/g, ""));
      return Number.isNaN(n) ? value : `$${n.toFixed(2)}`;
    }
    if (key === "cost_type") {
      return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (typeof value[0] === "string") return value.join(", ");
    // Array of objects (e.g. media_keys, participants)
    const isFileLike = value.some(
      (v) => v != null && typeof v === "object" && ("s3Key" in v || "s3_key" in v)
    );
    if (isFileLike) return `${value.length} file(s)`;
    return `${value.length} item(s)`;
  }

  if (typeof value === "object") return "—";
  return String(value);
}
