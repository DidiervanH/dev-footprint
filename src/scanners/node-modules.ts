import fs from "node:fs";
import path from "node:path";
import type { DuplicatePackage, ScannedLocation } from "../types.js";
import { collapseHome, expandHome, getDirSize, pathExists, readJsonFile } from "../utils.js";

export interface NodeModulesResult {
  location: ScannedLocation;
  duplicates: DuplicatePackage[];
  allPackages: { name: string; version: string; size: number }[];
}

interface PackageRecord {
  name: string;
  version: string;
  path: string;
  size: number;
}

/**
 * Walk a directory tree up to maxDepth looking for node_modules/ directories.
 * Skips hidden directories, symlinks, and node_modules nested inside other node_modules.
 */
function findNodeModulesDirs(dir: string, maxDepth: number, insideNodeModules: boolean): string[] {
  if (maxDepth < 0) return [];

  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      // Skip hidden directories
      if (entry.startsWith(".")) continue;

      const fullPath = path.join(dir, entry);

      try {
        const stat = fs.lstatSync(fullPath);

        // Skip symlinks
        if (stat.isSymbolicLink()) continue;

        if (!stat.isDirectory()) continue;

        if (entry === "node_modules") {
          // Skip node_modules nested inside other node_modules
          if (insideNodeModules) continue;
          results.push(fullPath);
          // Don't recurse into node_modules looking for more node_modules
        } else {
          // Recurse into non-node_modules directories
          const nested = findNodeModulesDirs(fullPath, maxDepth - 1, insideNodeModules);
          results.push(...nested);
        }
      } catch {
        // Skip entries we can't stat (permission errors, etc.)
      }
    }
  } catch {
    // Can't read directory
  }

  return results;
}

/**
 * List all top-level packages inside a node_modules directory.
 * Handles scoped packages (@org/pkg) by listing subdirs of @-prefixed entries.
 * Returns an array of { name, dirPath } for each package.
 */
function listPackages(nodeModulesDir: string): { name: string; dirPath: string }[] {
  const packages: { name: string; dirPath: string }[] = [];

  try {
    const entries = fs.readdirSync(nodeModulesDir);
    for (const entry of entries) {
      // Skip hidden entries and special directories
      if (entry.startsWith(".")) continue;

      const fullPath = path.join(nodeModulesDir, entry);

      try {
        const stat = fs.lstatSync(fullPath);
        if (stat.isSymbolicLink()) continue;
        if (!stat.isDirectory()) continue;

        if (entry.startsWith("@")) {
          // Scoped package - list subdirectories
          try {
            const scopedEntries = fs.readdirSync(fullPath);
            for (const scopedEntry of scopedEntries) {
              if (scopedEntry.startsWith(".")) continue;

              const scopedPath = path.join(fullPath, scopedEntry);

              try {
                const scopedStat = fs.lstatSync(scopedPath);
                if (scopedStat.isSymbolicLink()) continue;
                if (!scopedStat.isDirectory()) continue;

                packages.push({
                  name: `${entry}/${scopedEntry}`,
                  dirPath: scopedPath,
                });
              } catch {
                // Skip entries we can't stat
              }
            }
          } catch {
            // Can't read scoped directory
          }
        } else {
          packages.push({ name: entry, dirPath: fullPath });
        }
      } catch {
        // Skip entries we can't stat
      }
    }
  } catch {
    // Can't read node_modules directory
  }

  return packages;
}

/**
 * Scan the given root directories for node_modules/ directories,
 * report their sizes, and detect duplicate packages across repos.
 */
export function scanNodeModules(scanRoots: string[]): NodeModulesResult {
  const MAX_WALK_DEPTH = 4;
  const nodeModulesDirs: string[] = [];

  // Step 1: Find all node_modules directories across scan roots
  for (const root of scanRoots) {
    const expandedRoot = expandHome(root);
    if (!pathExists(expandedRoot)) continue;

    try {
      const stat = fs.lstatSync(expandedRoot);
      if (stat.isSymbolicLink() || !stat.isDirectory()) continue;
    } catch {
      continue;
    }

    const found = findNodeModulesDirs(expandedRoot, MAX_WALK_DEPTH, false);
    nodeModulesDirs.push(...found);
  }

  // Step 2: Get size of each node_modules and build children
  const children: ScannedLocation[] = [];
  let totalSize = 0;

  for (const nmDir of nodeModulesDirs) {
    try {
      const size = getDirSize(nmDir);
      totalSize += size;

      children.push({
        path: collapseHome(nmDir),
        category: "node_modules",
        size_bytes: size,
        status: "active",
      });
    } catch {
      // Skip node_modules we can't measure
    }
  }

  // Step 3: Detect duplicate packages across repos
  // Collect all packages from all node_modules
  const allPackages: PackageRecord[] = [];

  for (const nmDir of nodeModulesDirs) {
    const packages = listPackages(nmDir);

    for (const pkg of packages) {
      try {
        const pkgJsonPath = path.join(pkg.dirPath, "package.json");
        const pkgJson = readJsonFile<{ name?: string; version?: string }>(pkgJsonPath);
        if (!pkgJson || !pkgJson.version) continue;

        const size = getDirSize(pkg.dirPath);

        allPackages.push({
          name: pkg.name,
          version: pkgJson.version,
          path: nmDir,
          size,
        });
      } catch {
        // Skip packages we can't read
      }
    }
  }

  // Group by name+version
  const packageGroups = new Map<string, PackageRecord[]>();
  for (const pkg of allPackages) {
    const key = `${pkg.name}@${pkg.version}`;
    const group = packageGroups.get(key);
    if (group) {
      group.push(pkg);
    } else {
      packageGroups.set(key, [pkg]);
    }
  }

  // Find duplicates (3+ repos with same name+version)
  const duplicates: DuplicatePackage[] = [];
  for (const [, records] of packageGroups) {
    if (records.length < 3) continue;

    // Use the first record's size as representative size per copy
    const sizePerCopy = records[0].size;
    const wastedCopies = records.length - 1;

    duplicates.push({
      name: records[0].name,
      version: records[0].version,
      locations: records.map((r) => collapseHome(r.path)),
      size_per_copy: sizePerCopy,
      total_wasted_bytes: sizePerCopy * wastedCopies,
    });
  }

  // Sort duplicates by total wasted bytes descending
  duplicates.sort((a, b) => b.total_wasted_bytes - a.total_wasted_bytes);

  // Step 4: Build top-level location
  const location: ScannedLocation = {
    path: "Node Modules",
    category: "node_modules",
    size_bytes: totalSize,
    status: "active",
    item_count: nodeModulesDirs.length,
    children,
  };

  return {
    location,
    duplicates,
    allPackages: allPackages.map((p) => ({
      name: p.name,
      version: p.version,
      size: p.size,
    })),
  };
}
