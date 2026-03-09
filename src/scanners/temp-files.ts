import fs from "node:fs";
import path from "node:path";
import type { ScannedLocation } from "../types.js";
import { getDirSize, pathExists } from "../utils.js";

const TMP_DIR = "/tmp/";
const CLAUDE_PREFIX = "claude-";

export function scanTempFiles(): {
  location: ScannedLocation;
  details: { path: string; count: number; size_bytes: number };
} {
  let totalSize = 0;
  let count = 0;

  try {
    if (pathExists(TMP_DIR)) {
      const entries = fs.readdirSync(TMP_DIR);
      for (const entry of entries) {
        if (entry.startsWith(CLAUDE_PREFIX)) {
          const fullPath = path.join(TMP_DIR, entry);
          try {
            const stat = fs.lstatSync(fullPath);
            if (stat.isSymbolicLink()) {
              totalSize += stat.size;
            } else if (stat.isDirectory()) {
              totalSize += getDirSize(fullPath);
            } else {
              totalSize += stat.size;
            }
            count++;
          } catch {
            // Skip entries we can't stat (permission errors, etc.)
          }
        }
      }
    }
  } catch {
    // Handle permission errors on /tmp/ gracefully
  }

  const location: ScannedLocation = {
    path: "/tmp/claude-*",
    category: "temp",
    size_bytes: totalSize,
    status: "stale",
    item_count: count,
  };

  const details = {
    path: "/tmp/claude-*",
    count,
    size_bytes: totalSize,
  };

  return { location, details };
}
