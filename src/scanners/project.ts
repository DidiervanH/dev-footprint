import fs from "node:fs";
import path from "node:path";
import type { ScannedLocation } from "../types.js";
import { collapseHome, countItems, getDirSize, getFileSize, pathExists } from "../utils.js";

const FIFTY_MB = 50 * 1024 * 1024;

/**
 * Scan a specific project directory for Claude-related files.
 *
 * Checks for:
 * - CLAUDE.md — get size
 * - .claude/ directory — get size, list children (commands/, agents/, rules/, skills/, settings.json)
 * - .mcp.json — get size
 * - .claude.json — get size, flag if > 50 MB (history bloat)
 *
 * Returns a ScannedLocation with children for each found item,
 * or null if nothing Claude-related is found.
 */
export function scanProject(dirPath: string): ScannedLocation | null {
  try {
    if (!pathExists(dirPath)) {
      return null;
    }

    const children: ScannedLocation[] = [];

    // 1. Check for CLAUDE.md
    const claudeMdPath = path.join(dirPath, "CLAUDE.md");
    if (pathExists(claudeMdPath)) {
      const size = getFileSize(claudeMdPath);
      children.push({
        path: collapseHome(claudeMdPath),
        category: "claude",
        size_bytes: size,
        status: "active",
        item_count: 1,
      });
    }

    // 2. Check for .claude/ directory
    const claudeDir = path.join(dirPath, ".claude");
    if (pathExists(claudeDir)) {
      try {
        const stat = fs.statSync(claudeDir);
        if (stat.isDirectory()) {
          const claudeDirSize = getDirSize(claudeDir);
          const claudeDirChildren: ScannedLocation[] = [];

          const subdirs = ["commands", "agents", "rules", "skills"];
          for (const subdir of subdirs) {
            const subdirPath = path.join(claudeDir, subdir);
            if (pathExists(subdirPath)) {
              try {
                const subdirStat = fs.statSync(subdirPath);
                if (subdirStat.isDirectory()) {
                  claudeDirChildren.push({
                    path: collapseHome(subdirPath),
                    category: "claude",
                    size_bytes: getDirSize(subdirPath),
                    status: "active",
                    item_count: countItems(subdirPath),
                  });
                }
              } catch {
                // Skip on error
              }
            }
          }

          // Check settings.json
          const settingsPath = path.join(claudeDir, "settings.json");
          if (pathExists(settingsPath)) {
            claudeDirChildren.push({
              path: collapseHome(settingsPath),
              category: "claude",
              size_bytes: getFileSize(settingsPath),
              status: "active",
              item_count: 1,
            });
          }

          children.push({
            path: collapseHome(claudeDir),
            category: "claude",
            size_bytes: claudeDirSize,
            status: "active",
            item_count: countItems(claudeDir),
            children: claudeDirChildren.length > 0 ? claudeDirChildren : undefined,
          });
        }
      } catch {
        // Skip on error
      }
    }

    // 3. Check for .mcp.json
    const mcpJsonPath = path.join(dirPath, ".mcp.json");
    if (pathExists(mcpJsonPath)) {
      const size = getFileSize(mcpJsonPath);
      children.push({
        path: collapseHome(mcpJsonPath),
        category: "claude",
        size_bytes: size,
        status: "active",
        item_count: 1,
      });
    }

    // 4. Check for .claude.json (history file — flag if > 50 MB)
    const claudeJsonPath = path.join(dirPath, ".claude.json");
    if (pathExists(claudeJsonPath)) {
      const size = getFileSize(claudeJsonPath);
      const isBloated = size > FIFTY_MB;
      children.push({
        path: collapseHome(claudeJsonPath),
        category: "claude",
        size_bytes: size,
        status: isBloated ? "stale" : "active",
        item_count: 1,
      });
    }

    // Return null if nothing Claude-related was found
    if (children.length === 0) {
      return null;
    }

    const totalSize = children.reduce((sum, c) => sum + c.size_bytes, 0);

    return {
      path: collapseHome(dirPath),
      category: "claude",
      size_bytes: totalSize,
      status: "active",
      item_count: children.length,
      children,
    };
  } catch {
    return null;
  }
}
