import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Check if a path exists on the filesystem.
 */
export function pathExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recursively calculate the total size of a directory in bytes.
 * Returns 0 if the directory doesn't exist or can't be read.
 * Uses lstatSync to avoid following symlinks (prevents infinite loops
 * and misleading size reports from symlinks pointing outside the tree).
 * maxDepth prevents stack overflow from extremely deep directory trees.
 */
export function getDirSize(dirPath: string, maxDepth = 50): number {
  try {
    if (maxDepth <= 0) return 0;
    if (!pathExists(dirPath)) return 0;
    const stat = fs.lstatSync(dirPath);
    if (stat.isSymbolicLink()) return stat.size;
    if (!stat.isDirectory()) return stat.size;

    let totalSize = 0;
    const entries = fs.readdirSync(dirPath);
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      try {
        const entryStat = fs.lstatSync(fullPath);
        if (entryStat.isSymbolicLink()) {
          totalSize += entryStat.size;
        } else if (entryStat.isDirectory()) {
          totalSize += getDirSize(fullPath, maxDepth - 1);
        } else {
          totalSize += entryStat.size;
        }
      } catch {
        // Skip entries we can't read
      }
    }
    return totalSize;
  } catch {
    return 0;
  }
}

/**
 * Count the number of items (files and directories) in a directory (non-recursive).
 * Returns 0 if the directory doesn't exist or can't be read.
 */
export function countItems(dirPath: string): number {
  try {
    if (!pathExists(dirPath)) return 0;
    return fs.readdirSync(dirPath).length;
  } catch {
    return 0;
  }
}

/**
 * Expand ~ to the user's home directory.
 */
export function expandHome(filePath: string): string {
  if (filePath.startsWith("~/") || filePath === "~") {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

/**
 * Collapse the user's home directory path back to ~.
 */
export function collapseHome(filePath: string): string {
  const home = os.homedir();
  if (filePath === home) {
    return "~";
  }
  if (filePath.startsWith(`${home}/`)) {
    return `~${filePath.slice(home.length)}`;
  }
  return filePath;
}

/**
 * Formats a byte count into a human-readable string using 1024-based units.
 * Examples: "0 B", "4.2 KB", "192 MB", "1.5 GB"
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const base = 1024;

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);

  const value = bytes / base ** exponent;

  if (exponent === 0) {
    return `${Math.round(value)} B`;
  }

  // Use up to 1 decimal place, but drop trailing .0
  const formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[exponent]}`;
}

/**
 * Walk directory trees looking for directories with a specific name.
 * Skips symlinks and hidden directories (starting with .).
 * Skips nested matches (e.g., node_modules inside node_modules).
 */
export function findDirectories(roots: string[], targetName: string, maxDepth = 4): string[] {
  const results: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth <= 0) return;
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (entry.startsWith(".")) continue;
        const fullPath = path.join(dir, entry);
        try {
          const stat = fs.lstatSync(fullPath);
          if (stat.isSymbolicLink()) continue;
          if (!stat.isDirectory()) continue;
          if (entry === targetName) {
            results.push(fullPath);
            // Don't recurse into the target itself
            continue;
          }
          walk(fullPath, depth - 1);
        } catch {
          // Skip entries we can't stat
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  for (const root of roots) {
    const expanded = expandHome(root);
    if (pathExists(expanded)) {
      walk(expanded, maxDepth);
    }
  }

  return results;
}

/**
 * Returns default scan root directories that exist on disk.
 */
export function getDefaultScanRoots(): string[] {
  const candidates = [
    "~/Repositories",
    "~/Projects",
    "~/Developer",
    "~/Code",
    "~/workspace",
    "~/repos",
    "~/src",
  ];
  return candidates.filter((c) => pathExists(expandHome(c)));
}

/**
 * Reads a JSON file and parses it. Returns null on any error.
 */
export function readJsonFile<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Categories below this threshold are collapsed as "minor" in reports.
 */
export const MINOR_CATEGORY_THRESHOLD = 100 * 1024 * 1024;

/**
 * Escapes a string for safe embedding in a single-quoted shell argument.
 * Wraps the value in single quotes and escapes any embedded single quotes
 * using the '\'' idiom (end quote, escaped literal quote, reopen quote).
 *
 * This prevents shell metacharacter injection ($, `, \, ", newlines, etc.)
 * because single-quoted strings in POSIX shells treat all characters literally
 * except for the single quote itself.
 */
export function shellEscape(value: string): string {
  // Replace every ' with '\'' — ends the single-quoted string, adds an
  // escaped literal single quote, then reopens the single-quoted string.
  const escaped = value.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

/**
 * Get the size of a single file in bytes. Returns 0 if the file doesn't exist.
 */
export function getFileSize(filePath: string): number {
  try {
    const stat = fs.lstatSync(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}
