import type { ScannedLocation } from "../types.js";

/**
 * Sorts scanned locations by size_bytes in descending order (largest first).
 * Returns a new array; does not mutate the input.
 */
export function analyzeDiskUsage(locations: ScannedLocation[]): ScannedLocation[] {
  return [...locations].sort((a, b) => b.size_bytes - a.size_bytes);
}

/**
 * Returns the sum of all top-level location sizes in bytes.
 */
export function getTotalSize(locations: ScannedLocation[]): number {
  return locations.reduce((sum, loc) => sum + loc.size_bytes, 0);
}
