import type { ScannedLocation } from "../types.js";
import { collapseHome, countItems, expandHome, getDirSize, pathExists } from "../utils.js";

/**
 * Scan iOS device backups.
 *
 * Paths checked:
 * - ~/Library/Application Support/MobileSync/Backup/  (iTunes/Finder device backups)
 */
export function scanIOSBackups(): ScannedLocation {
  const children: ScannedLocation[] = [];

  const backupPath = expandHome("~/Library/Application Support/MobileSync/Backup");
  if (pathExists(backupPath)) {
    const size = getDirSize(backupPath);
    if (size > 0) {
      children.push({
        path: collapseHome(backupPath),
        category: "ios_backups",
        size_bytes: size,
        status: "active",
        item_count: countItems(backupPath),
      });
    }
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "iOS Backups",
    category: "ios_backups",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
