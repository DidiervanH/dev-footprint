import path from "node:path";
import type { ScannedLocation } from "../types.js";
import { collapseHome, countItems, expandHome, getDirSize, pathExists } from "../utils.js";

/**
 * Scan Homebrew installation and cache directories on macOS.
 *
 * Detects the Homebrew prefix:
 * - /opt/homebrew/ (Apple Silicon)
 * - /usr/local/Homebrew/ (Intel)
 *
 * Reports:
 * 1. Cellar directory — installed formula sizes
 * 2. ~/Library/Caches/Homebrew/ — download cache
 *
 * Does not shell out to `brew`; only checks filesystem paths.
 *
 * Returns a single top-level ScannedLocation with children for each found directory.
 */
export function scanHomebrew(): ScannedLocation {
  const children: ScannedLocation[] = [];

  try {
    // Determine Homebrew prefix
    let brewPrefix: string | null = null;
    if (pathExists("/opt/homebrew/")) {
      brewPrefix = "/opt/homebrew";
    } else if (pathExists("/usr/local/Homebrew/")) {
      brewPrefix = "/usr/local/Homebrew";
    }

    // Scan Cellar if Homebrew is installed
    if (brewPrefix) {
      const cellarPath = path.join(brewPrefix, "Cellar");
      if (pathExists(cellarPath)) {
        const size = getDirSize(cellarPath);
        const items = countItems(cellarPath);

        children.push({
          path: collapseHome(cellarPath),
          category: "homebrew",
          size_bytes: size,
          status: "active",
          item_count: items,
        });
      }
    }

    // Scan Homebrew download cache
    const cachePath = expandHome("~/Library/Caches/Homebrew/");
    if (pathExists(cachePath)) {
      const size = getDirSize(cachePath);
      const items = countItems(cachePath);

      children.push({
        path: collapseHome(cachePath),
        category: "homebrew",
        size_bytes: size,
        status: "stale",
        item_count: items,
      });
    }
  } catch {
    // Gracefully handle any unexpected errors
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "Homebrew",
    category: "homebrew",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
