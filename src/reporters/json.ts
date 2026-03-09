import type { FootprintReport } from "../types.js";

/**
 * Serializes a FootprintReport to a pretty-printed JSON string.
 */
export function reportJson(report: FootprintReport): string {
  return JSON.stringify(report, null, 2);
}
