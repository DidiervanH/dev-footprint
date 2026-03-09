import fs from "node:fs";
import path from "node:path";
import type { ScannedLocation } from "../types.js";
import { expandHome, getDirSize, pathExists } from "../utils.js";

const VERSIONS_DIR = "~/.local/share/claude/versions/";
const SYMLINK_PATH = "~/.local/bin/claude";
const STATE_DIR = "~/.local/state/claude/";

export function scanCliVersions(activeVersion: string): ScannedLocation {
  const versionsDir = expandHome(VERSIONS_DIR);
  const children: ScannedLocation[] = [];
  let hasActive = false;
  let hasStale = false;

  if (pathExists(versionsDir)) {
    try {
      const entries = fs.readdirSync(versionsDir);
      for (const entry of entries) {
        const versionPath = path.join(versionsDir, entry);
        try {
          const stat = fs.statSync(versionPath);
          if (stat.isDirectory()) {
            const isActive = entry === activeVersion;
            if (isActive) hasActive = true;
            else hasStale = true;

            const size = getDirSize(versionPath);
            children.push({
              path: `${VERSIONS_DIR}${entry}/`,
              category: "claude",
              size_bytes: size,
              status: isActive ? "active" : "stale",
            });
          }
        } catch {
          // Skip entries we can't stat
        }
      }
    } catch {
      // Can't read versions directory
    }
  }

  // Scan the symlink at ~/.local/bin/claude
  const symlinkPath = expandHome(SYMLINK_PATH);
  if (pathExists(symlinkPath)) {
    try {
      const stat = fs.lstatSync(symlinkPath);
      children.push({
        path: SYMLINK_PATH,
        category: "claude",
        size_bytes: stat.size,
        status: "active",
      });
    } catch {
      // Skip if we can't read the symlink
    }
  }

  // Scan state directory ~/.local/state/claude/
  const stateDir = expandHome(STATE_DIR);
  if (pathExists(stateDir)) {
    try {
      const size = getDirSize(stateDir);
      children.push({
        path: STATE_DIR,
        category: "claude",
        size_bytes: size,
        status: "active",
      });
    } catch {
      // Skip if we can't read the state directory
    }
  }

  const totalSize = children.reduce((sum, child) => sum + child.size_bytes, 0);

  let status: ScannedLocation["status"];
  if (hasActive && hasStale) {
    status = "partial_stale";
  } else if (hasStale && !hasActive) {
    status = "stale";
  } else if (hasActive) {
    status = "active";
  } else {
    status = "unknown";
  }

  return {
    path: VERSIONS_DIR,
    category: "claude",
    size_bytes: totalSize,
    status,
    item_count: children.length,
    children,
  };
}
