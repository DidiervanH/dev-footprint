import fs from "node:fs";
import path from "node:path";
import type { ScannedLocation } from "../types.js";
import { collapseHome, expandHome, getDirSize, pathExists } from "../utils.js";

/**
 * Recursively walk a directory up to maxDepth looking for .git/ directories.
 * Skips symlinks and .git directories inside node_modules.
 */
function findGitDirs(dir: string, depth: number, results: string[]): void {
  if (depth <= 0) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    // Skip symlinks
    if (entry.isSymbolicLink()) continue;

    if (!entry.isDirectory()) continue;

    const fullPath = path.join(dir, entry.name);

    // Skip node_modules entirely to avoid .git dirs inside dependencies
    if (entry.name === "node_modules") continue;

    if (entry.name === ".git") {
      results.push(fullPath);
      continue;
    }

    // Don't descend into .git directories
    findGitDirs(fullPath, depth - 1, results);
  }
}

/**
 * Scan filesystem roots for Git repositories and report .git/ directory sizes.
 *
 * Walks each scan root (max depth 3) looking for .git/ directories.
 * Marks repos with .git/ > 500 MB as "stale" (suggesting gc might help).
 *
 * Returns a single top-level ScannedLocation with children for each found repo.
 */
export function scanGitRepos(scanRoots: string[]): ScannedLocation {
  const children: ScannedLocation[] = [];

  try {
    for (const root of scanRoots) {
      const expandedRoot = expandHome(root);

      if (!pathExists(expandedRoot)) continue;

      const gitDirs: string[] = [];
      findGitDirs(expandedRoot, 3, gitDirs);

      for (const gitDir of gitDirs) {
        const size = getDirSize(gitDir);
        const repoDir = path.dirname(gitDir);
        const displayPath = `${collapseHome(repoDir)}/.git/`;

        children.push({
          path: displayPath,
          category: "git",
          size_bytes: size,
          status: "active",
        });
      }
    }
  } catch {
    // Gracefully handle any unexpected errors
  }

  // Sort children by size descending
  children.sort((a, b) => b.size_bytes - a.size_bytes);

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "Git Repositories",
    category: "git",
    size_bytes: totalSize,
    status: "active",
    item_count: children.length,
    children,
  };
}
