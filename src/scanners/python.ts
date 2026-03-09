import fs from "node:fs";
import path from "node:path";
import type { ScannedLocation } from "../types.js";
import { collapseHome, expandHome, getDirSize, pathExists } from "../utils.js";

const VENV_DIR_NAMES = ["venv", ".venv", "env"];

/**
 * Check whether a directory is an actual Python virtual environment
 * by looking for bin/python (Unix) or Scripts/python.exe (Windows).
 */
function isVirtualEnv(dirPath: string): boolean {
  return (
    pathExists(path.join(dirPath, "bin", "python")) ||
    pathExists(path.join(dirPath, "Scripts", "python.exe"))
  );
}

/**
 * Walk a directory tree up to `maxDepth` levels, collecting paths of
 * directories that look like Python virtual environments.
 */
function findVenvs(root: string, maxDepth: number): string[] {
  const results: string[] = [];

  function walk(dir: string, depth: number): void {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        // Skip hidden dirs (other than .venv) and node_modules to keep it fast
        if (entry.startsWith(".") && entry !== ".venv") continue;
        if (entry === "node_modules") continue;

        const fullPath = path.join(dir, entry);
        try {
          const stat = fs.lstatSync(fullPath);
          if (stat.isSymbolicLink()) continue;
          if (!stat.isDirectory()) continue;

          if (VENV_DIR_NAMES.includes(entry) && isVirtualEnv(fullPath)) {
            results.push(fullPath);
          } else {
            walk(fullPath, depth + 1);
          }
        } catch {
          // Skip entries we can't stat
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walk(root, 1);
  return results;
}

/**
 * List subdirectories of a given path, returning their full paths.
 * Returns an empty array if the path doesn't exist or isn't readable.
 */
function listSubdirectories(dirPath: string): string[] {
  try {
    if (!pathExists(dirPath)) return [];
    const entries = fs.readdirSync(dirPath);
    const dirs: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      try {
        const stat = fs.lstatSync(fullPath);
        if (stat.isDirectory() && !stat.isSymbolicLink()) {
          dirs.push(fullPath);
        }
      } catch {
        // Skip entries we can't stat
      }
    }
    return dirs;
  } catch {
    return [];
  }
}

/**
 * Scan for Python-related disk usage: virtual environments, pip cache,
 * conda environments, and pyenv versions.
 */
export function scanPython(scanRoots: string[]): ScannedLocation {
  const children: ScannedLocation[] = [];

  // 1. Virtual environments — walk each scan root (max depth 3)
  for (const root of scanRoots) {
    const expandedRoot = expandHome(root);
    if (!pathExists(expandedRoot)) continue;

    const venvPaths = findVenvs(expandedRoot, 3);
    for (const venvPath of venvPaths) {
      const size = getDirSize(venvPath);
      children.push({
        path: collapseHome(venvPath),
        category: "python",
        size_bytes: size,
        status: "active",
      });
    }
  }

  // 2. pip cache (macOS)
  const pipCachePath = expandHome("~/Library/Caches/pip/");
  if (pathExists(pipCachePath)) {
    const size = getDirSize(pipCachePath);
    children.push({
      path: collapseHome(pipCachePath),
      category: "python",
      size_bytes: size,
      status: "stale",
    });
  }

  // 3. Conda environments
  const condaBasePaths = ["~/miniconda3/envs/", "~/anaconda3/envs/", "~/miniforge3/envs/"];
  for (const condaBase of condaBasePaths) {
    const expandedBase = expandHome(condaBase);
    if (!pathExists(expandedBase)) continue;

    const envDirs = listSubdirectories(expandedBase);
    for (const envDir of envDirs) {
      const size = getDirSize(envDir);
      children.push({
        path: collapseHome(envDir),
        category: "python",
        size_bytes: size,
        status: "active",
      });
    }
  }

  // 4. pyenv versions
  const pyenvVersionsPath = expandHome("~/.pyenv/versions/");
  if (pathExists(pyenvVersionsPath)) {
    const versionDirs = listSubdirectories(pyenvVersionsPath);
    for (const versionDir of versionDirs) {
      const size = getDirSize(versionDir);
      children.push({
        path: collapseHome(versionDir),
        category: "python",
        size_bytes: size,
        status: "active",
      });
    }
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "Python",
    category: "python",
    size_bytes: totalSize,
    status: "active",
    item_count: children.length,
    children,
  };
}
