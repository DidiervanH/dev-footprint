import os from "node:os";
import path from "node:path";
import type { ScannedLocation } from "../types.js";
import { collapseHome, getDirSize, getFileSize, pathExists } from "../utils.js";

/**
 * Scan macOS desktop app locations for Claude Desktop.
 *
 * Checks:
 * 1. ~/Library/Application Support/Claude/ — app data
 * 2. ~/Library/Caches/com.anthropic.claudefordesktop/ — cache
 * 3. ~/Library/Preferences/com.anthropic.claudefordesktop.plist — preferences
 *
 * Returns a single ScannedLocation with children for each found sub-location.
 */
export function scanDesktopApp(): ScannedLocation {
  const children: ScannedLocation[] = [];

  try {
    const home = os.homedir();

    // 1. Application Support
    const appSupportPath = path.join(home, "Library", "Application Support", "Claude");
    if (pathExists(appSupportPath)) {
      const size = getDirSize(appSupportPath);
      children.push({
        path: collapseHome(appSupportPath),
        category: "claude",
        size_bytes: size,
        status: "active",
      });
    }

    // 2. Caches
    const cachePath = path.join(home, "Library", "Caches", "com.anthropic.claudefordesktop");
    if (pathExists(cachePath)) {
      const size = getDirSize(cachePath);
      children.push({
        path: collapseHome(cachePath),
        category: "claude",
        size_bytes: size,
        status: "active",
      });
    }

    // 3. Preferences plist
    const prefPath = path.join(
      home,
      "Library",
      "Preferences",
      "com.anthropic.claudefordesktop.plist",
    );
    if (pathExists(prefPath)) {
      const size = getFileSize(prefPath);
      children.push({
        path: collapseHome(prefPath),
        category: "claude",
        size_bytes: size,
        status: "active",
      });
    }
  } catch {
    // Gracefully handle any unexpected errors
  }

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "~/Library/ (Claude Desktop)",
    category: "claude",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
