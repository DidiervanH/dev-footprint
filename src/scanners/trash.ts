import type { ScannedLocation } from "../types.js";
import { collapseHome, countItems, expandHome, getDirSize, pathExists } from "../utils.js";

/**
 * Scan ~/.Trash/ directory.
 *
 * Everything in the trash is reclaimable — marked as stale.
 */
export function scanTrash(): ScannedLocation {
  const trashPath = expandHome("~/.Trash");

  if (!pathExists(trashPath)) {
    return {
      path: "~/.Trash",
      category: "trash",
      size_bytes: 0,
      status: "unknown",
      item_count: 0,
    };
  }

  const size = getDirSize(trashPath);
  const items = countItems(trashPath);

  return {
    path: collapseHome(trashPath),
    category: "trash",
    size_bytes: size,
    status: size > 0 ? "stale" : "unknown",
    item_count: items,
  };
}
