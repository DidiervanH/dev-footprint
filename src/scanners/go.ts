import type { ScannedLocation } from "../types.js";
import { collapseHome, countItems, expandHome, getDirSize, pathExists } from "../utils.js";

/**
 * Scan Go directories.
 *
 * Paths checked:
 * - ~/go/                          (GOPATH default — pkg, bin, src)
 * - ~/Library/Caches/go-build/     (build cache)
 * - ~/go/pkg/mod/                  (module cache)
 */
export function scanGo(): ScannedLocation {
  const children: ScannedLocation[] = [];

  const locations = [
    { path: "~/go/pkg/mod", label: "Go module cache" },
    { path: "~/go/bin", label: "Go binaries" },
    { path: "~/Library/Caches/go-build", label: "Go build cache" },
  ];

  for (const loc of locations) {
    const full = expandHome(loc.path);
    if (pathExists(full)) {
      const size = getDirSize(full);
      if (size > 0) {
        children.push({
          path: collapseHome(full),
          category: "go",
          size_bytes: size,
          status: "active",
          item_count: countItems(full),
        });
      }
    }
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "Go",
    category: "go",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
