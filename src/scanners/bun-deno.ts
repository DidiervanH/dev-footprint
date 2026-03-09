import type { ScannedLocation } from "../types.js";
import { collapseHome, countItems, expandHome, getDirSize, pathExists } from "../utils.js";

/**
 * Scan Bun and Deno directories.
 *
 * Paths checked:
 * - ~/.bun/           (Bun runtime, installed packages, cache)
 * - ~/.deno/          (Deno cache, compiled modules)
 * - ~/Library/Caches/deno/  (Deno cache on macOS)
 */
export function scanBunDeno(): ScannedLocation {
  const children: ScannedLocation[] = [];

  const locations = [
    { path: "~/.bun", label: "Bun" },
    { path: "~/.deno", label: "Deno" },
    { path: "~/Library/Caches/deno", label: "Deno cache" },
  ];

  for (const loc of locations) {
    const full = expandHome(loc.path);
    if (pathExists(full)) {
      const size = getDirSize(full);
      if (size > 0) {
        children.push({
          path: collapseHome(full),
          category: "bun_deno",
          size_bytes: size,
          status: "active",
          item_count: countItems(full),
        });
      }
    }
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "Bun / Deno",
    category: "bun_deno",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
