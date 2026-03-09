import type { ScannedLocation } from "../types.js";
import {
  collapseHome,
  countItems,
  expandHome,
  findDirectories,
  getDirSize,
  pathExists,
} from "../utils.js";

/**
 * Scan CocoaPods cache and Pods directories across projects.
 *
 * Paths checked:
 * - ~/Library/Caches/CocoaPods/  (download cache)
 * - Pods/ directories in scan roots (installed pod dependencies)
 */
export function scanCocoaPods(scanRoots: string[]): ScannedLocation {
  const children: ScannedLocation[] = [];

  // CocoaPods cache
  const cachePath = expandHome("~/Library/Caches/CocoaPods");
  if (pathExists(cachePath)) {
    const size = getDirSize(cachePath);
    if (size > 0) {
      children.push({
        path: collapseHome(cachePath),
        category: "cocoapods",
        size_bytes: size,
        status: "stale",
        item_count: countItems(cachePath),
      });
    }
  }

  // Find Pods directories in project roots
  const podsDirs = findDirectories(scanRoots, "Pods", 4);
  for (const podsDir of podsDirs) {
    const size = getDirSize(podsDir);
    if (size > 0) {
      children.push({
        path: collapseHome(podsDir),
        category: "cocoapods",
        size_bytes: size,
        status: "active",
        item_count: countItems(podsDir),
      });
    }
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "CocoaPods",
    category: "cocoapods",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
