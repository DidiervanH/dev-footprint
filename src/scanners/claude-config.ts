import fs from "node:fs";
import path from "node:path";
import type { ScannedLocation } from "../types.js";
import { countItems, expandHome, getDirSize, pathExists } from "../utils.js";

const CLAUDE_DIR = "~/.claude/";

const KNOWN_FILES = ["settings.json", "CLAUDE.md", "history.jsonl"] as const;

const KNOWN_DIRS = [
  "projects",
  "session-env",
  "file-history",
  "shell-snapshots",
  "telemetry",
  "debug",
  "paste-cache",
  "plans",
  "tasks",
  "todos",
  "backups",
  "cache",
  "statsig",
  "ide",
  "plugins",
] as const;

export function scanClaudeConfig(): ScannedLocation {
  const claudeDir = expandHome(CLAUDE_DIR);

  if (!pathExists(claudeDir)) {
    return {
      path: CLAUDE_DIR,
      category: "claude",
      size_bytes: 0,
      status: "unknown",
      item_count: 0,
      children: [],
    };
  }

  const children: ScannedLocation[] = [];

  // Scan known files
  for (const fileName of KNOWN_FILES) {
    const filePath = path.join(claudeDir, fileName);
    if (pathExists(filePath)) {
      try {
        const stat = fs.statSync(filePath);
        children.push({
          path: `${CLAUDE_DIR}${fileName}`,
          category: "claude",
          size_bytes: stat.size,
          status: "active",
        });
      } catch {
        // Skip files we can't stat
      }
    }
  }

  // Scan known directories
  for (const dirName of KNOWN_DIRS) {
    const dirPath = path.join(claudeDir, dirName);
    if (pathExists(dirPath)) {
      try {
        const size = getDirSize(dirPath);
        const count = countItems(dirPath);
        children.push({
          path: `${CLAUDE_DIR}${dirName}/`,
          category: "claude",
          size_bytes: size,
          status: "active",
          item_count: count,
        });
      } catch {
        // Skip directories we can't read
      }
    }
  }

  const totalSize = children.reduce((sum, child) => sum + child.size_bytes, 0);

  return {
    path: CLAUDE_DIR,
    category: "claude",
    size_bytes: totalSize,
    status: "active",
    item_count: children.length,
    children,
  };
}
