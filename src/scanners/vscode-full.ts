import os from "node:os";
import path from "node:path";
import type { ScannedLocation } from "../types.js";
import { collapseHome, countItems, getDirSize, pathExists } from "../utils.js";

/**
 * Scan all VS Code disk usage (extensions, workspace storage, caches).
 * This is separate from the Claude-specific VS Code scanner.
 */
export function scanVSCodeFull(): ScannedLocation {
  const children: ScannedLocation[] = [];

  try {
    const home = os.homedir();

    // 1. All extensions
    const extensionsDir = path.join(home, ".vscode", "extensions");
    if (pathExists(extensionsDir)) {
      const size = getDirSize(extensionsDir);
      const count = countItems(extensionsDir);
      children.push({
        path: collapseHome(extensionsDir),
        category: "vscode",
        size_bytes: size,
        status: "active",
        item_count: count,
      });
    }

    // 2. Workspace storage
    const workspaceStorage = path.join(
      home,
      "Library",
      "Application Support",
      "Code",
      "User",
      "workspaceStorage",
    );
    if (pathExists(workspaceStorage)) {
      const size = getDirSize(workspaceStorage);
      const count = countItems(workspaceStorage);
      children.push({
        path: collapseHome(workspaceStorage),
        category: "vscode",
        size_bytes: size,
        status: "active",
        item_count: count,
      });
    }

    // 3. Cache
    const cacheDir = path.join(home, "Library", "Application Support", "Code", "Cache");
    if (pathExists(cacheDir)) {
      const size = getDirSize(cacheDir);
      children.push({
        path: collapseHome(cacheDir),
        category: "vscode",
        size_bytes: size,
        status: "active",
      });
    }

    // 4. CachedData
    const cachedData = path.join(home, "Library", "Application Support", "Code", "CachedData");
    if (pathExists(cachedData)) {
      const size = getDirSize(cachedData);
      children.push({
        path: collapseHome(cachedData),
        category: "vscode",
        size_bytes: size,
        status: "active",
      });
    }

    // 5. CachedExtensionVSIXs (all, not just Claude)
    const cachedVSIXs = path.join(
      home,
      "Library",
      "Application Support",
      "Code",
      "CachedExtensionVSIXs",
    );
    if (pathExists(cachedVSIXs)) {
      const size = getDirSize(cachedVSIXs);
      const count = countItems(cachedVSIXs);
      children.push({
        path: collapseHome(cachedVSIXs),
        category: "vscode",
        size_bytes: size,
        status: "stale",
        item_count: count,
      });
    }

    // 6. Logs
    const logsDir = path.join(home, "Library", "Application Support", "Code", "logs");
    if (pathExists(logsDir)) {
      const size = getDirSize(logsDir);
      children.push({
        path: collapseHome(logsDir),
        category: "vscode",
        size_bytes: size,
        status: "stale",
      });
    }
  } catch {
    // Gracefully handle errors
  }

  children.sort((a, b) => b.size_bytes - a.size_bytes);

  const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

  return {
    path: "VS Code",
    category: "vscode",
    size_bytes: totalSize,
    status: children.length > 0 ? "active" : "unknown",
    item_count: children.length,
    children,
  };
}
