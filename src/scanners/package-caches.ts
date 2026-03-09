import type { ScannedLocation } from "../types.js";
import { collapseHome, countItems, expandHome, getDirSize, pathExists } from "../utils.js";

/**
 * Scan npm, yarn, and pnpm global caches.
 *
 * Paths checked:
 * - ~/.npm/          (npm cache)
 * - ~/Library/Caches/Yarn/  (Yarn v1 cache)
 * - ~/.yarn/berry/cache/    (Yarn v2+ cache)
 * - ~/.pnpm-store/          (pnpm content-addressable store)
 */
export function scanPackageCaches(): ScannedLocation {
  const children: ScannedLocation[] = [];

  const locations = [
    { path: "~/.npm", label: "npm cache", stale: true },
    { path: "~/Library/Caches/Yarn", label: "Yarn cache", stale: true },
    { path: "~/.yarn/berry/cache", label: "Yarn Berry cache", stale: true },
    { path: "~/.pnpm-store", label: "pnpm store", stale: false },
  ];

  for (const loc of locations) {
    const full = expandHome(loc.path);
    if (pathExists(full)) {
      const size = getDirSize(full);
      if (size > 0) {
        children.push({
          path: collapseHome(full),
          category: "package_caches",
          size_bytes: size,
          status: loc.stale ? "stale" : "active",
          item_count: countItems(full),
        });
      }
    }
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "Package Manager Caches",
    category: "package_caches",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
