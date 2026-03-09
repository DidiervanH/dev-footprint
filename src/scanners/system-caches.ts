import fs from "node:fs";
import type { ScannedLocation } from "../types.js";
import { collapseHome, expandHome, getDirSize, pathExists } from "../utils.js";

/**
 * Scan ~/Library/Caches/ for large cache directories, excluding ones
 * already covered by other scanners (Homebrew, CocoaPods, Yarn, Go, Deno).
 *
 * Reports subdirectories > 50 MB individually.
 *
 * Distinguishes between:
 * - Dev tool caches (safe to delete, auto-regenerated): marked "stale"
 * - App caches (needed for UX — sessions, offline data): marked "active"
 */

// Caches already covered by dedicated scanners — skip entirely
const EXCLUDED_CACHES = new Set(["homebrew", "cocoapods", "yarn", "go-build", "deno"]);

// Dev tool caches that are safe to delete (auto-regenerated on next build/install)
const DEV_TOOL_CACHES = new Set([
  "ms-playwright",
  "ms-playwright-go",
  "pnpm",
  "typescript",
  "node-gyp",
  "pip",
  "com.apple.dt.xcode",
  "org.swift.swiftpm",
  "carthage",
  "gradle",
  "com.facebook.buck",
  "turbo",
  "nx",
  "jest",
  "vitest",
  "eslint",
  "prettier",
  "biome",
]);

function isExcluded(name: string): boolean {
  const lower = name.toLowerCase();
  for (const exc of EXCLUDED_CACHES) {
    if (lower.includes(exc)) return true;
  }
  return false;
}

function isDevToolCache(name: string): boolean {
  const lower = name.toLowerCase();
  for (const dev of DEV_TOOL_CACHES) {
    if (lower.includes(dev)) return true;
  }
  return false;
}

export function scanSystemCaches(): ScannedLocation {
  const children: ScannedLocation[] = [];
  const FIFTY_MB = 50 * 1024 * 1024;

  const cachesDir = expandHome("~/Library/Caches");
  if (!pathExists(cachesDir)) {
    return {
      path: "~/Library/Caches",
      category: "system_caches",
      size_bytes: 0,
      status: "unknown",
      item_count: 0,
      children: [],
    };
  }

  try {
    const entries = fs.readdirSync(cachesDir);
    for (const entry of entries) {
      if (isExcluded(entry)) continue;

      const fullPath = `${cachesDir}/${entry}`;
      try {
        const stat = fs.lstatSync(fullPath);
        if (stat.isSymbolicLink() || !stat.isDirectory()) continue;

        const size = getDirSize(fullPath);
        if (size >= FIFTY_MB) {
          children.push({
            path: collapseHome(fullPath),
            category: "system_caches",
            size_bytes: size,
            // Only dev tool caches are safe to reclaim
            status: isDevToolCache(entry) ? "stale" : "active",
          });
        }
      } catch {
        // skip unreadable entries
      }
    }
  } catch {
    // can't read caches dir
  }

  children.sort((a, b) => b.size_bytes - a.size_bytes);
  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "~/Library/Caches",
    category: "system_caches",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
