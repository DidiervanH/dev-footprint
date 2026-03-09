import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ScannedLocation } from "../types.js";
import { collapseHome, getDirSize, pathExists } from "../utils.js";

const EXTENSION_PREFIX = "anthropic.claude-code-";

/**
 * Compare two semver-like version strings.
 * Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  const maxLen = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] ?? 0;
    const numB = partsB[i] ?? 0;
    if (numA !== numB) {
      return numA - numB;
    }
  }
  return 0;
}

/**
 * Extract version string from a Claude extension directory name.
 * e.g. "anthropic.claude-code-1.2.3" -> "1.2.3"
 */
function extractVersion(dirName: string): string {
  if (dirName.startsWith(EXTENSION_PREFIX)) {
    return dirName.slice(EXTENSION_PREFIX.length);
  }
  return "";
}

/**
 * Scan VS Code extensions for Claude Code.
 *
 * 1. Glob ~/.vscode/extensions/ for directories matching anthropic.claude-code-*
 * 2. Extract version from dir name, get size
 * 3. Sort by version (semver-like), mark all but latest as "stale"
 * 4. Check ~/Library/Application Support/Code/CachedExtensionVSIXs/ for VSIX files
 */
export function scanVSCode(): ScannedLocation {
  const children: ScannedLocation[] = [];
  let hasStale = false;

  try {
    const home = os.homedir();

    // 1. Scan extension directories
    const extensionsDir = path.join(home, ".vscode", "extensions");
    if (pathExists(extensionsDir)) {
      try {
        const entries = fs.readdirSync(extensionsDir, { withFileTypes: true });
        const claudeExtensions: Array<{
          name: string;
          version: string;
          fullPath: string;
        }> = [];

        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.startsWith(EXTENSION_PREFIX)) {
            const version = extractVersion(entry.name);
            if (version) {
              claudeExtensions.push({
                name: entry.name,
                version,
                fullPath: path.join(extensionsDir, entry.name),
              });
            }
          }
        }

        // Sort by version ascending (oldest first)
        claudeExtensions.sort((a, b) => compareVersions(a.version, b.version));

        // Mark all but the last (latest) as stale
        for (let i = 0; i < claudeExtensions.length; i++) {
          const ext = claudeExtensions[i];
          const isLatest = i === claudeExtensions.length - 1;
          const size = getDirSize(ext.fullPath);

          if (!isLatest) {
            hasStale = true;
          }

          children.push({
            path: collapseHome(ext.fullPath),
            category: "claude",
            size_bytes: size,
            status: isLatest ? "active" : "stale",
            item_count: 1,
          });
        }
      } catch {
        // Skip if we can't read extensions dir
      }
    }

    // 2. Check cached VSIXs
    const vsixCacheDir = path.join(
      home,
      "Library",
      "Application Support",
      "Code",
      "CachedExtensionVSIXs",
    );
    if (pathExists(vsixCacheDir)) {
      try {
        const entries = fs.readdirSync(vsixCacheDir);
        for (const entry of entries) {
          if (entry.startsWith(EXTENSION_PREFIX)) {
            const fullPath = path.join(vsixCacheDir, entry);
            try {
              const stat = fs.statSync(fullPath);
              if (stat.isFile()) {
                children.push({
                  path: collapseHome(fullPath),
                  category: "claude",
                  size_bytes: stat.size,
                  status: "stale",
                  item_count: 1,
                });
                hasStale = true;
              }
            } catch {
              // Skip files that can't be stat'd
            }
          }
        }
      } catch {
        // Skip if we can't read VSIX cache dir
      }
    }
  } catch {
    // Gracefully handle any unexpected errors
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "~/.vscode/extensions/ (Claude)",
    category: "claude",
    size_bytes: totalSize,
    status: hasStale ? "partial_stale" : children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
